import Vocabulary from "../models/Vocabulary.js";
import Category from "../models/Category.js";
import VocabularyTranslation from "../models/VocabularyTranslation.js";

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

export async function addVocabulary(categories = [], translations = []) {
  const vocab = await Vocabulary.create();
  const categoryIds = await ensureCategories(categories);
  if (categoryIds.length) await vocab.setCategories(categoryIds);

  for (const t of translations) {
    if (!t || !t.language || !t.text) continue;
    await VocabularyTranslation.create({
      vocabularyId: vocab.id,
      language: t.language,
      text: t.text,
      description: t.description || null,
    });
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
      await VocabularyTranslation.create({
        vocabularyId: id,
        language: t.language,
        text: t.text,
        description: t.description || null,
      });
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

// Parse uploaded file content (JSON or CSV) and create vocabularies
// Parse uploaded file content (JSON or CSV) and create vocabularies
// Supports test file format with columns: en, vi, zh-tw, desc.en, desc.vi, desc.tw, categories
export async function addVocabularyFromFile(fileContent) {
  let parsed = null;
  // Try JSON first
  try {
    parsed = JSON.parse(fileContent.toString());
  } catch (e) {
    // fallback to CSV/TSV parsing
    const text = fileContent.toString();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return { created: 0, errors: ["empty file"] };
    const headers = lines[0].split(/,|\t/).map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => line.split(/,|\t/).map(c => c.trim()));
    parsed = rows.map(cols => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
      return obj;
    });
  }

  // parsed should be an array of entries
  if (!Array.isArray(parsed)) return { created: 0, errors: ["invalid file format"] };

  const results = { created: 0, errors: [] };
  for (const row of parsed) {
    try {
      // parse categories (multiple separated by | ; ,)
      const cats = [];
      if (row.categories) {
        const split = String(row.categories).split(/\||;|,/).map(s => s.trim()).filter(Boolean);
        cats.push(...split);
      }

      // If the file follows the test format with language columns, build translations array
      const hasLangColumns = ('en' in row) || ('vi' in row) || ('zh-tw' in row) || ('zh_tw' in row);
      if (hasLangColumns) {
        const translations = [];
        if (row.en) translations.push({ language: 'en', text: row.en, description: row['desc.en'] || row['desc_en'] || '' });
        if (row.vi) translations.push({ language: 'vi', text: row.vi, description: row['desc.vi'] || row['desc_vi'] || '' });
        // support header variants for zh-tw like 'zh-tw' or 'zh_tw' or 'zh'
        const zhtKey = ('zh-tw' in row) ? 'zh-tw' : (('zh_tw' in row) ? 'zh_tw' : (('zh' in row) ? 'zh' : null));
        if (zhtKey && row[zhtKey]) translations.push({ language: 'zh-tw', text: row[zhtKey], description: row['desc.tw'] || row['desc_tw'] || '' });

        if (translations.length === 0) {
          results.errors.push('no translation columns found in row');
          continue;
        }

        await addVocabulary(cats, translations);
        results.created++;
        continue;
      }

      // If row contains translations (multiple languages) in JSON form use that
      if (row.translations && typeof row.translations === 'string') {
        try {
          const tlist = JSON.parse(row.translations);
          await addVocabulary(cats, tlist);
          results.created++;
          continue;
        } catch (e) {
          // fallthrough to single translation
        }
      }

      // Fallback: single translation fields
      if (row.language && row.text) {
        await addVocabulary(cats, [{ language: row.language, text: row.text, description: row.description || '' }]);
        results.created++;
        continue;
      }

      results.errors.push('row missing translation fields');
    } catch (err) {
      results.errors.push(err.message || String(err));
    }
  }

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
