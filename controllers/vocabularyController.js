import * as vocabService from "../services/vocabularyService.js";

export const addVocabulary = async (req, res) => {
  try {
    const { categories, translations } = req.body;
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ success: false, message: "Categories are required", data: null });
    }
    if (!Array.isArray(translations) || translations.length === 0) {
      return res.status(400).json({ success: false, message: "Translations are required", data: null });
    }

    const vocab = await vocabService.addVocabulary(categories, translations);
    return res.status(201).json({ success: true, message: "Vocabulary created successfully", data: { id: vocab.id } });
  } catch (error) {
    console.error("Error creating vocabulary:", error);
    return res.status(500).json({ success: false, message: "Internal server error", data: null });
  }
};

export const addVocabularyFromFile = async (req, res) => {
  try {
    // Accept file via multipart (req.file.buffer) or raw content in req.body.fileContent
    const fileBuffer = req.file?.buffer || (req.body?.fileContent ? Buffer.from(req.body.fileContent) : null);
    if (!fileBuffer) return res.status(400).json({ success: false, message: "No file provided", data: null });

    const result = await vocabService.addVocabularyFromFile(fileBuffer);
    return res.status(201).json({ success: true, message: "File processed", data: result });
  } catch (error) {
    console.error("Error importing vocab from file:", error);
    return res.status(500).json({ success: false, message: "Internal server error", data: null });
  }
};

export const getVocabularyList = async (req, res) => {
  try {
    const formatted = await vocabService.getVocabularyList();
    return res.json({ success: true, message: "Vocabulary list fetched successfully", data: formatted });
  } catch (error) {
    console.error("Error fetching vocabulary list:", error);
    return res.status(500).json({ success: false, message: "Internal server error", data: null });
  }
};

export const updateVocabulary = async (req, res) => {
  try {
    const { id } = req.params;
    const { categories, translations } = req.body;
    const vocab = await vocabService.updateVocabulary(id, categories, translations);
    if (!vocab) return res.status(404).json({ success: false, message: "Vocabulary not found", data: null });
    return res.json({ success: true, message: "Vocabulary updated successfully", data: { id: vocab.id } });
  } catch (error) {
    console.error("Error updating vocabulary:", error);
    return res.status(500).json({ success: false, message: "Internal server error", data: null });
  }
};

export const deleteVocabulary = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await vocabService.deleteVocabulary(id);
    if (!ok) return res.status(404).json({ success: false, message: "Vocabulary not found", data: null });
    return res.json({ success: true, message: "Vocabulary deleted successfully", data: null });
  } catch (error) {
    console.error("Error deleting vocabulary:", error);
    return res.status(500).json({ success: false, message: "Internal server error", data: null });
  }
};

export const getVocabularyById = async (req, res) => {
  try {
    const { id } = req.params;
    const vocab = await vocabService.getVocabularyById(id);
    if (!vocab) return res.status(404).json({ success: false, message: "Vocabulary not found", data: null });

    const formatted = {
      id: vocab.id,
      translations: vocab.VocabularyTranslations.map(t => ({ lang: t.language, text: t.text, desc: t.description })),
      categories: vocab.Categories.map(c => ({ id: c.id, name: c.name })),
      createdAt: vocab.createdAt,
      updatedAt: vocab.updatedAt,
    };

    return res.json({ success: true, message: "Vocabulary fetched successfully", data: formatted });
  } catch (error) {
    console.error("Error fetching vocabulary by id:", error);
    return res.status(500).json({ success: false, message: "Internal server error", data: null });
  }
};
