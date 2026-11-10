import Vocabulary from "../models/Vocabulary.js";
import VocabularyTranslation from "../models/VocabularyTranslation.js";
import Category from "../models/Category.js";
import { embed as embedText } from "../services/CAG/embedding.js";
import sequelize from "../config/db.js";

/**
 * Normalize multilingual text
 */
function normalize(t = "") {
  const cleaned = t.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  return /[\u4e00-\u9fa5]/.test(cleaned) ? cleaned : cleaned.toLowerCase();
}

/**
 * Detect source language
 */
function detectSourceLanguage(text) {
  if (/[\u4e00-\u9fa5]/.test(text)) return "zh-tw";
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return "vi";
  return "en";
}

/**
 * Calculate relevance score for term matching
 */
// Compute cosine similarity between two vectors


/**
 * Retrieve top 5 most relevant vocab items
 */
async function getRelevantVocab(text, categoryNames = [], targetLangs = ["en"], maxResults = 8) {
  const normalizedText = text.trim();
  if (!normalizedText) return [];

  // Map để gộp điểm từ 2 luồng: { vocabId: { vocabObj, keywordScore, vectorScore } }
  const resultMap = new Map();
  const catsCondition = categoryNames && categoryNames.length > 0 
    ? categoryNames.map(c => `'${c}'`).join(',') 
    : null;

  try {
    // =====================================================================
    // LUỒNG 1: KEYWORD SEARCH (EXACT MATCH bằng SQL)
    // Tốc độ ánh sáng, độ chính xác 100%
    // =====================================================================
    let textQuery = `
      SELECT vt."vocabularyId", vt.text
      FROM "VocabularyTranslations" vt
    `;
    
    if (catsCondition) {
      textQuery += `
        JOIN "VocabularyCategories" vc ON vc."vocabularyId" = vt."vocabularyId"
        JOIN "Categories" c ON c.id = vc."categoryId" AND c.name IN (${catsCondition})
      `;
    }

    // Tìm các từ vựng xuất hiện lọt thỏm trong câu input
    textQuery += `
      WHERE LENGTH(vt.text) >= 2 
      AND POSITION(LOWER(vt.text) IN LOWER(:inputText)) > 0
    `;

    const [keywordResults] = await sequelize.query(textQuery, {
      replacements: { inputText: normalizedText }
    });

    if (keywordResults && keywordResults.length > 0) {
      keywordResults.forEach(r => {
        // Điểm Keyword phụ thuộc vào độ dài từ (Từ càng dài, ngữ cảnh càng hẹp -> Điểm càng cao)
        // Mình gán hệ số 1.0 (Tuyệt đối) + Bonus độ dài
        const score = 1.0 + (r.text.length * 0.01); 
        resultMap.set(r.vocabularyId, { vocabularyId: r.vocabularyId, keywordScore: score, vectorScore: 0 });
      });
      console.log(`[HybridSearch] Luồng 1 (Keyword): Bắt được ${keywordResults.length} từ khớp chính xác.`);
    }

    // =====================================================================
    // LUỒNG 2: VECTOR SEARCH (SEMANTIC)
    // Cứu cánh cho lỗi chính tả, từ đồng nghĩa, chia động từ
    // =====================================================================
    try {
      // Nhúng câu input thành Vector
      const queryVector = await embedText(normalizedText); 
      // Chuyển mảng float thành chuỗi '[0.12, -0.45, ...]' để PostgreSQL pgvector hiểu
      const vectorStr = `[${queryVector.join(',')}]`;

      // Giả sử bảng Vocabulary có cột 'embedding' kiểu vector
      let vectorQuery = `
        SELECT v.id AS "vocabularyId", 
               1 - (v.embedding <=> :vectorStr::vector) AS similarity_score
        FROM "Vocabularies" v
      `;

      if (catsCondition) {
        vectorQuery += `
          JOIN "VocabularyCategories" vc ON vc."vocabularyId" = v.id
          JOIN "Categories" c ON c.id = vc."categoryId" AND c.name IN (${catsCondition})
        `;
      }

      // Chỉ lấy những từ có độ tương đồng > 0.65 (tùy model embedding của bạn)
      vectorQuery += `
        WHERE 1 - (v.embedding <=> :vectorStr::vector) > 0.65
        ORDER BY similarity_score DESC
        LIMIT 10
      `;

      const [vectorResults] = await sequelize.query(vectorQuery, {
        replacements: { vectorStr }
      });

      if (vectorResults && vectorResults.length > 0) {
        vectorResults.forEach(r => {
          const existing = resultMap.get(r.vocabularyId);
          if (existing) {
             existing.vectorScore = parseFloat(r.similarity_score);
          } else {
             resultMap.set(r.vocabularyId, { 
               vocabularyId: r.vocabularyId, 
               keywordScore: 0, 
               vectorScore: parseFloat(r.similarity_score) 
             });
          }
        });
        console.log(`[HybridSearch] Luồng 2 (Vector): Tìm thấy ${vectorResults.length} từ có liên quan ngữ nghĩa.`);
      }
    } catch (vecErr) {
       console.error("[HybridSearch] Lỗi gọi Vector Search (Có thể chưa cài pgvector hoặc gọi API lỗi):", vecErr.message);
    }

    // =====================================================================
    // BƯỚC 3: MERGE, RANKING VÀ FETCH FULL DATA
    // =====================================================================
    const uniqueVocabIds = Array.from(resultMap.keys());

    if (uniqueVocabIds.length > 0) {
      // Kéo full data text/language lên để build Prompt
      const finalVocabs = await Vocabulary.findAll({
        where: { id: uniqueVocabIds },
        include: [
          { model: VocabularyTranslation, attributes: ["language", "text"] },
          { model: Category, as: "Categories", through: { attributes: [] } }
        ],
      });

      // TÍNH ĐIỂM TỔNG HỢP (Alpha * Keyword + Beta * Vector)
      // Keyword ưu tiên tuyệt đối, Vector là phụ trợ
      const scoredVocabs = finalVocabs.map(vocab => {
        const scores = resultMap.get(vocab.id);
        // Công thức lai: Trọng số Keyword 70% (1.0), Vector 30% (0.3)
        // Nếu khớp Exact Match, điểm chắc chắn > 1.0. Nếu chỉ giống ngữ nghĩa, điểm < 0.3.
        const finalScore = (scores.keywordScore * 1.0) + (scores.vectorScore * 0.3);
        return { vocab, score: finalScore };
      });

      // Sắp xếp điểm giảm dần và lấy Top N (maxResults)
      const sortedVocabs = scoredVocabs
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(item => item.vocab);
      
      console.log(`[HybridSearch] Chốt sổ Top ${sortedVocabs.length} từ vựng gửi cho LLM.`);
      return sortedVocabs;
    }

  } catch (err) {
    console.error("[getRelevantVocab] Hybrid search failed, falling back to heuristic JS:", err.message);
    // (Bên dưới bạn có thể giữ lại đoạn JS Fallback cũ nếu DB PostgreSQL sập)
  }

  return [];
}
/**
 * Build dynamic examples based on target language
 */
function buildExamples(vocabs, targetLangs) {
  const examples = [];
  
  // Get first vocab with all translations
  const firstVocab = vocabs.find(v => {
    const map = {};
    v.VocabularyTranslations.forEach(t => map[t.language] = t.text);
    return map.en && map.vi && map["zh-tw"];
  });

  if (!firstVocab) {
    return [
      "Input: 鞋眼織帶的沖子直徑必須為4毫米。",
      'Output: {"source_language":"zh-tw","translation":{"en":"The punch hole diameter of the eyestay webbing must be 4 millimeters."}}'
    ];
  }

  const map = {};
  firstVocab.VocabularyTranslations.forEach(t => map[t.language] = t.text);

  // Build examples for each target language
  targetLangs.forEach(targetLang => {
    if (targetLang === "en") {
      examples.push(`ZH→EN: "${map["zh-tw"]}" → {"source_language":"zh-tw","translation":{"en":"${map.en}"}}`);
      examples.push(`VI→EN: "${map.vi}" → {"source_language":"vi","translation":{"en":"${map.en}"}}`);
    } else if (targetLang === "vi") {
      examples.push(`EN→VI: "${map.en}" → {"source_language":"en","translation":{"vi":"${map.vi}"}}`);
      examples.push(`ZH→VI: "${map["zh-tw"]}" → {"source_language":"zh-tw","translation":{"vi":"${map.vi}"}}`);
    } else if (targetLang === "zh-tw") {
      examples.push(`EN→ZH: "${map.en}" → {"source_language":"en","translation":{"zh-tw":"${map["zh-tw"]}"}}`);
      examples.push(`VI→ZH: "${map.vi}" → {"source_language":"vi","translation":{"zh-tw":"${map["zh-tw"]}"}}`);
    }
  });

  return examples;
}

/**
 * Build RAG system prompt with TOP 5 most similar terms
 */
export default async function buildCategoryPrompt(
  text,
  targetLangs = ["en"],
  categoryNames = [],
  maxVocabItems = 5
) {
  const vocabs = await getRelevantVocab(text, categoryNames, targetLangs, maxVocabItems);
  const detectedLang = detectSourceLanguage(text);

  // Build TERMS section (bidirectional for all languages)
  let termLines = [];
  let termIndex = 1;
  vocabs.forEach((v) => {
    const map = {};
    v.VocabularyTranslations.forEach((t) => (map[t.language] = t.text));
    
    // Show all available mappings
    if (map.en || map.vi || map["zh-tw"]) {
      const parts = [];
      if (map["zh-tw"]) parts.push(`ZH:"${map["zh-tw"]}"`);
      if (map.vi) parts.push(`VI:"${map.vi}"`);
      if (map.en) parts.push(`EN:"${map.en}"`);
      
      if (parts.length >= 2) {
        termLines.push(`${termIndex}. ${parts.join(" ⟷ ")}`);
        termIndex++;
      }
    }
  });

  const toLangs = targetLangs.map(l => l.toUpperCase()).join(", ");
  const examples = buildExamples(vocabs, targetLangs);

  // Build enhanced system prompt
  const systemPrompt = [
    "### ROLE",
    "You are a multilingual *technical translator*.",
    "",
    "### TASK",
    "1. **Detect source language**: Identify if input is VI, EN, or ZH-TW",
    `2. **Translate to**: ${toLangs}`,
    "3. **Use EXACT terms**: When you find a word/phrase in TERMS below, use the EXACT translation provided",
    "",
    "### TERMS (TOP 5 most similar - bidirectional)",
    termLines.length ? termLines.join("\n") : "None",
    "",
    "### CRITICAL RULES",
    "- If input is ZH-TW (Chinese characters detected) → set source_language to \"zh-tw\"",
    "- If input is VI (Vietnamese diacritics detected) → set source_language to \"vi\"",
    "- If input is EN (Latin alphabet, no diacritics) → set source_language to \"en\"",
    "- Use EXACT term from TERMS list (e.g., ZH:\"沖子\" MUST become EN:\"punch hole diameter\", NOT \"punch\" or \"hole\")",
    "",
    "### FORMAT",
    `Return JSON only:\n{"source_language":"vi|en|zh-tw","translation":{${targetLangs.map((l) => `"${l}":"exact_translation"`).join(",")}}}`,
    "If you used any term from the TERMS list in your translation, include these optional keys in the JSON:`matched_categories` (array of category names where those terms came from).",
    "",
    "### EXAMPLES",
    ...examples,
    "",
    "**Remember**: COPY terms from TERMS list exactly, detect source language correctly!"
  ].join("\n");

  console.log(`[buildCategoryPrompt] Detected source: ${detectedLang}, Target: ${toLangs}`);
  console.log(`[buildCategoryPrompt] Selected TOP ${vocabs.length} most relevant terms`);

  return systemPrompt;
}
