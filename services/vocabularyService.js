import Vocabulary from "../models/Vocabulary.js";
import Category from "../models/Category.js";
import VocabularyTranslation from "../models/VocabularyTranslation.js";
import VocabularyCategory from "../models/VocabularyCategory.js";
import { embed as embedText } from "../services/CAG/embedding.js";
import sequelize from "../config/db.js";
import XLSX from "xlsx";
// small delay helper to avoid hitting embedding endpoint rate limits
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Helper: ensure categories exist and return their ids
async function ensureCategories(categoryInputs = []) {
  const ids = [];
  for (const c of categoryInputs) {
    if (!c) continue;
    // If numeric id provided, try to use it
    if (typeof c === "number" || /^[0-9]+$/.test(String(c))) {
      const existing = await Category.findByPk(Number(c));
      if (existing) ids.push(existing.id);
      continue;
    }

    const name = String(c).trim();
    if (!name) continue;
    const [cat] = await Category.findOrCreate({ where: { name } });
    ids.push(cat.id);
  }
  return ids;
}

async function createWithSequenceRepair(Model, data, tableName) {
  try {
    return await Model.create(data);
  } catch (err) {
    if (err && err.name === 'SequelizeUniqueConstraintError' && sequelize.getDialect() === 'postgres') {
      try {
        const query = `SELECT pg_get_serial_sequence('"${tableName}"','id') AS seq`;
        const result = await sequelize.query(query);
        const seq = result[0]?.[0]?.seq;
        if (seq) {
          await sequelize.query(
            `SELECT setval('${seq}', (SELECT COALESCE(MAX(id), 0) FROM "${tableName}"))`
          );
          console.log(`[db] Repaired sequence ${seq} for ${tableName} and retrying CREATE`);
          return await Model.create(data);
        }
      } catch (repairErr) {
        console.error(`[db] Failed to repair sequence for ${tableName}:`, repairErr);
      }
    }
    throw err;
  }
}

export async function addVocabulary(categories = [], translations = []) {
  // Create vocabulary row; handle possible Postgres sequence mismatch (duplicate id)
  const vocab = await createWithSequenceRepair(Vocabulary, {}, "Vocabularies");
  const categoryIds = await ensureCategories(categories);
  if (categoryIds.length) await vocab.setCategories(categoryIds);

  for (const t of translations) {
    if (!t || !t.language || !t.text) continue;
    const vt = await createWithSequenceRepair(VocabularyTranslation, {
      vocabularyId: vocab.id,
      language: t.language,
      text: t.text,
      description: t.description || null,
    }, "VocabularyTranslations");

    try {
      const vector = await embedText(vt.text);
      vt.embeddings = vector;
      await vt.save();
    } catch (err) {
      console.error("Embedding failed for new translation:", vt.text, err.message || err);
    }
    // small delay to avoid hitting embedding endpoint rate limits
    await delay(200);
  }

  return vocab;
}

export async function getVocabularyList() {
  const vocabularies = await Vocabulary.findAll({
    attributes: ["id"],
    include: [
      { model: VocabularyTranslation, attributes: ["language", "text", "description"] },
      { model: Category, attributes: ["id", "name"], through: { attributes: [] } },
    ],
    order: [["createdAt", "DESC"]],
  });

  return vocabularies.map(v => ({
    id: v.id,
    translations: v.VocabularyTranslations.map(t => ({ lang: t.language, text: t.text, desc: t.description })),
    categories: v.Categories.map(c => ({ id: c.id, name: c.name })),
  }));
}

export async function updateVocabulary(id, categories, translations) {
  const vocab = await Vocabulary.findByPk(id);
  if (!vocab) return null;

  if (Array.isArray(categories)) {
    const categoryIds = await ensureCategories(categories);
    await vocab.setCategories(categoryIds);
  }

  if (Array.isArray(translations)) {
    await VocabularyTranslation.destroy({ where: { vocabularyId: id } });
    for (const t of translations) {
      if (!t || !t.language || !t.text) continue;
      const vt = await createWithSequenceRepair(VocabularyTranslation, {
        vocabularyId: id,
        language: t.language,
        text: t.text,
        description: t.description || null,
      }, "VocabularyTranslations");

      try {
        const vector = await embedText(vt.text);
        vt.embeddings = vector;
        await vt.save();
      } catch (err) {
        console.error("Embedding failed for updated translation:", vt.text, err.message || err);
      }
      await delay(200);
    }
  }

  return vocab;
}

export async function deleteVocabulary(id) {
  const vocab = await Vocabulary.findByPk(id);
  if (!vocab) return false;
  await VocabularyTranslation.destroy({ where: { vocabularyId: id } });
  await vocab.setCategories([]);
  await vocab.destroy();
  return true;
}

export async function getVocabularyById(id) {
  const vocab = await Vocabulary.findOne({
    where: { id },
    attributes: ["id", "createdAt", "updatedAt"],
    include: [
      { model: VocabularyTranslation, attributes: ["language", "text", "description"] },
      { model: Category, attributes: ["id", "name"], through: { attributes: [] } },
    ],
  });

  return vocab;
}

/**
 * Task 1: File Parser
 * Reads Excel/CSV buffer and parses it into header and row objects.
 */
function parseExcelFile(fileContent) {
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false
  });

  if (rawRows.length === 0) {
    throw new Error("File is empty");
  }

  const headers = rawRows[0].map(h => String(h).trim().toLowerCase());
  const rows = rawRows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, index) => {
      obj[h] = row[index] !== undefined ? String(row[index]).trim() : "";
    });
    return obj;
  });

  return { headers, rows };
}

/**
 * Task 2: Data Transformer
 * Transforms raw Excel row objects into valid standardized objects for DB insert.
 */
function transformRowsToValidItems(rows, headers) {
  const validItems = [];
  const errors = [];

  for (const [index, row] of rows.entries()) {
    const cats = [];
    if (row.categories) {
      cats.push(...row.categories.split(/\||;|,/).map(s => s.trim()).filter(Boolean));
    }

    const translations = [];
    if (row['en']) {
      translations.push({
        language: 'en',
        text: row['en'],
        description: row['desc.en'] || row['desc_en'] || ""
      });
    }

    if (row['vi']) {
      translations.push({
        language: 'vi',
        text: row['vi'],
        description: row['desc.vi'] || row['desc_vi'] || ""
      });
    }

    const zhTwText = row['zh-tw'] || row['zh_tw'] || row['tw'];
    if (zhTwText) {
      translations.push({
        language: 'zh-tw',
        text: zhTwText,
        description: row['desc.tw'] || row['desc.zh-tw'] || row['desc.zhtw'] || row['desc_tw'] || ""
      });
    }

    if (translations.length === 0 && row.text) {
      translations.push({
        language: row.language || 'en',
        text: row.text,
        description: row.description || ''
      });
    }

    if (translations.length > 0) {
      validItems.push({ rowIndex: index + 2, cats, translations });
    } else {
      errors.push(`Row ${index + 2}: No valid translation columns found.`);
    }
  }

  if (validItems.length === 0 && errors.length === 0) {
    errors.push(`No data imported. Headers found: [${headers.join(', ')}]. Expected: 'en', 'vi', 'zh-tw'.`);
  }

  return { validItems, errors };
}

/**
 * Task 3: Database Maintenance (Optional)
 * Repairs Postgres sequence counters if needed.
 */
async function repairPostgresSequences() {
  if (sequelize.getDialect() !== 'postgres') return;
  try {
    const seqResV = await sequelize.query(`SELECT pg_get_serial_sequence('"Vocabularies"','id') AS seq`);
    const seqV = seqResV[0]?.[0]?.seq;
    if (seqV) {
      await sequelize.query(`SELECT setval('${seqV}', (SELECT COALESCE(MAX(id), 0) FROM "Vocabularies"))`);
    }
    const seqResVT = await sequelize.query(`SELECT pg_get_serial_sequence('"VocabularyTranslations"','id') AS seq`);
    const seqVT = seqResVT[0]?.[0]?.seq;
    if (seqVT) {
      await sequelize.query(`SELECT setval('${seqVT}', (SELECT COALESCE(MAX(id), 0) FROM "VocabularyTranslations"))`);
    }
  } catch (seqErr) {
    console.warn("[db] Sequence repair warning:", seqErr.message);
  }
}

/**
 * Task 4: Database Operations
 * Pre-fetches categories, creates Vocabularies, Translations, and VocabularyCategories using Managed Transaction.
 */
async function bulkInsertVocabularyItems(validItems) {
  const categoryMap = new Map();
  const allCatInputs = new Set();
  validItems.forEach(item => item.cats.forEach(c => allCatInputs.add(c)));

  for (const c of allCatInputs) {
    if (!c) continue;
    if (typeof c === "number" || /^[0-9]+$/.test(String(c))) {
      const existing = await Category.findByPk(Number(c));
      if (existing) categoryMap.set(c, existing.id);
      continue;
    }
    const name = String(c).trim();
    if (!name) continue;
    const [cat] = await Category.findOrCreate({ where: { name } });
    categoryMap.set(name, cat.id);
  }

  const t = await sequelize.transaction();
  try {
    const vocabPayloads = validItems.map(() => ({}));
    const createdVocabs = await Vocabulary.bulkCreate(vocabPayloads, {
      transaction: t,
      returning: true
    });

    const translationsPayload = [];
    const vocabCategoryPayload = [];

    validItems.forEach((item, idx) => {
      const vocabId = createdVocabs[idx].id;

      item.cats.forEach(catName => {
        const catId = categoryMap.get(catName);
        if (catId) {
          vocabCategoryPayload.push({ vocabularyId: vocabId, categoryId: catId });
        }
      });

      item.translations.forEach(tr => {
        translationsPayload.push({
          vocabularyId: vocabId,
          language: tr.language,
          text: tr.text,
          description: tr.description || null
        });
      });
    });

    const insertedVT = await VocabularyTranslation.bulkCreate(translationsPayload, {
      transaction: t,
      returning: true,
      hooks: false
    });

    if (vocabCategoryPayload.length > 0) {
      await VocabularyCategory.bulkCreate(vocabCategoryPayload, {
        transaction: t,
        ignoreDuplicates: true
      });
    }

    await t.commit();
    return { count: validItems.length, insertedVT };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Task 5: AI / External Service
 * Generates vector embeddings concurrently in parallel batches.
 */
async function generateBatchEmbeddings(insertedVT, concurrency = 15) {
  if (!insertedVT || insertedVT.length === 0) return;
  console.log(`[import] Batch generating embeddings for ${insertedVT.length} translations...`);

  for (let i = 0; i < insertedVT.length; i += concurrency) {
    const chunk = insertedVT.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (vt) => {
        try {
          const vector = await embedText(vt.text);
          if (vector && Array.isArray(vector)) {
            vt.embeddings = vector;
            await vt.save({ hooks: false });
          }
        } catch (embedErr) {
          console.error(`[import] Embedding failed for "${vt.text}":`, embedErr.message || embedErr);
        }
      })
    );
  }
}

/**
 * Orchestrator: addVocabularyFromFile
 * Coordinates the 5 independent sub-tasks.
 */
export async function addVocabularyFromFile(fileContent) {
  const results = { created: 0, errors: [] };

  // Task 1: File Parser
  let fileData;
  try {
    fileData = parseExcelFile(fileContent);
  } catch (err) {
    return { created: 0, errors: [`File parsing failed: ${err.message}. Make sure to upload a valid Excel or CSV file.`] };
  }

  // Task 2: Data Transformer
  const { validItems, errors } = transformRowsToValidItems(fileData.rows, fileData.headers);
  results.errors.push(...errors);

  if (validItems.length === 0) {
    return results;
  }

  // Task 3: Database Maintenance (Sequence repair)
  await repairPostgresSequences();

  // Task 4: Database Operations
  let bulkResult;
  try {
    bulkResult = await bulkInsertVocabularyItems(validItems);
    results.created = bulkResult.count;
  } catch (err) {
    results.errors.push(`Bulk database insert failed: ${err.message}`);
    return results;
  }

  // Task 5: AI / External Service
  await generateBatchEmbeddings(bulkResult.insertedVT);

  return results;
}
export default {
  addVocabulary,
  getVocabularyList,
  updateVocabulary,
  deleteVocabulary,
  getVocabularyById,
  addVocabularyFromFile,
};
