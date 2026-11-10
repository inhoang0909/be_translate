import Vocabulary from "../../models/Vocabulary.js";
import VocabularyTranslation from "../../models/VocabularyTranslation.js";
import Category from "../../models/Category.js";
import { embed as embedText } from "../CAG/embedding.js";
import { QdrantClient } from "@qdrant/js-client-rest";
import { searchTranslations } from "./textSearchService.js";
import { normalize } from "./languageService.js";

const URL = process.env.QDRANT_URL || 'http://gmo021.cansportsvg.com:6333';
const API_KEY = process.env.QDRANT_API_KEY || 'Vgtranslation_csvn_2026_0904';

const qdrant = new QdrantClient({
  url: URL,
  apiKey: API_KEY
});

const COLLECTION_NAME = "vocabulary_collection";

/**
 * Performs hybrid search combining keyword matching and vector similarity
 * @param {string} text - Search text
 * @param {Array<string>} categoryNames - Category filters (optional)
 * @param {Array<string>} targetLangs - Target languages (optional)
 * @param {number} maxResults - Maximum results to return
 * @returns {Promise<Array>} - Array of relevant vocabulary objects
 */
async function getRelevantVocab(text, categoryNames = [], targetLangs = ["en"], maxResults = 8) {
  const normalizedText = normalize(text);
  if (!normalizedText) return [];

  const resultMap = new Map(); // { vocabId: { keywordScore, vectorScore } }

  try {
    // ---------------------------------------------------------
    // LUỒNG 1: KEYWORD SEARCH (FUZZY MATCHING BẰNG TEXTSEARCH + PG_TRGM)
    // ---------------------------------------------------------
    const keywordResults = await searchTranslations(normalizedText, {
      categories: categoryNames?.length > 0 ? categoryNames : null,
      limit: 50,
      useTrgm: true
    });

    if (keywordResults?.length > 0) {
      keywordResults.forEach((r, index) => {
        const similarityScore = r.dataValues?.similarityScore;
        const dbText = r.text.toLowerCase().trim();
        const searchKeyword = normalizedText.toLowerCase().trim();
        const isExactMatch = (dbText === searchKeyword);
        const isChineseSearch = /[\u4e00-\u9fa5]/.test(searchKeyword);

        if (isExactMatch || similarityScore === 1) {
          // TRƯỜNG HỢP 1: Khớp tuyệt đối (Exact Match hoặc điểm Trgm = 1)
          const textLengthBoost = r.text.length * 0.01;
          const score = 1 + textLengthBoost;

          resultMap.set(r.vocabularyId, {
            vocabularyId: r.vocabularyId,
            keywordScore: score,
            vectorScore: 0
          });
        } else if (isChineseSearch && similarityScore === undefined) {
          // TRƯỜNG HỢP 2: Tìm thấy bằng LIKE cho tiếng Trung
          const partialScore = 0.9 - (index * 0.01);

          resultMap.set(r.vocabularyId, {
            vocabularyId: r.vocabularyId,
            keywordScore: partialScore,
            vectorScore: 0
          });
        }
      });
    }

    // ---------------------------------------------------------
    // LUỒNG 2: VECTOR SEARCH BẰNG QDRANT
    // ---------------------------------------------------------
    try {
      const queryVector = await embedText(normalizedText);

      const qdrantFilter = categoryNames?.length > 0
        ? {
          must: [
            {
              key: "categories",
              match: { any: categoryNames }
            }
          ]
        }
        : undefined;

      const qdrantResults = await qdrant.search(COLLECTION_NAME, {
        vector: queryVector,
        limit: 50,
        with_payload: true,
        score_threshold: 0.55,
        ...(qdrantFilter ? { filter: qdrantFilter } : {})
      });

      qdrantResults.forEach(item => {
        const vocabId = item.payload.vocabularyId;
        const score = item.score;

        const existing = resultMap.get(vocabId);
        if (existing) {
          existing.vectorScore = Math.max(existing.vectorScore || 0, score);
        } else {
          resultMap.set(vocabId, { vocabularyId: vocabId, keywordScore: 0, vectorScore: score });
        }
      });
    } catch (vecErr) {
      // Vector search failed, continue with fallback
    }

    // ---------------------------------------------------------
    // BƯỚC 3: MERGE VÀ FETCH FULL DATA
    // ---------------------------------------------------------
    const uniqueVocabIds = Array.from(resultMap.keys());

    if (uniqueVocabIds.length > 0) {
      const categoryInclude = {
        model: Category,
        as: "Categories",
        through: { attributes: [] }
      };

      if (categoryNames && categoryNames.length > 0) {
        categoryInclude.where = { name: categoryNames };
      }

      const finalVocabs = await Vocabulary.findAll({
        where: { id: uniqueVocabIds },
        include: [
          { model: VocabularyTranslation, attributes: ["language", "text"] },
          categoryInclude
        ]
      });

      const scoredVocabs = finalVocabs.map(vocab => {
        const scores = resultMap.get(vocab.id);
        const finalScore = (scores.keywordScore * 1.0) + (scores.vectorScore * 0.3);
        return { vocab, score: finalScore };
      });

      const sortedVocabs = scoredVocabs.sort((a, b) => b.score - a.score).slice(0, maxResults).map(item => item.vocab);
      return sortedVocabs;
    }

  } catch (err) {
    // Handle error silently
  }

  return [];
}

export { getRelevantVocab };
