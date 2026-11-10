/**
 * Language Detection and Normalization Service
 * Handles language detection, code normalization, and language name retrieval
 */

/**
 * Detects the source language from input text
 * @param {string} text - Input text to analyze
 * @returns {string} - Language code (zh-tw, vi, or en)
 */
function detectSourceLanguage(text) {
  if (/[\u4e00-\u9fa5]/.test(text)) return "zh-tw";
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return "vi";
  return "en";
}

/**
 * Normalizes language codes to standard format
 * @param {string} langCode - Language code or name (e.g., "Vietnamese", "vi", "EN")
 * @returns {string} - Normalized code (vi, en, zh-tw)
 */
function normalizeLangCode(langCode) {
  const code = langCode.toLowerCase().trim();
  if (code === "vi" || code === "vietnamese") return "vi";
  if (code === "en" || code === "english") return "en";
  if (code === "zh" || code === "zh-tw" || code === "zhtw" || code === "chinese" || code === "traditional chinese") return "zh-tw";
  return code;
}

/**
 * Gets the full language name from a language code
 * @param {string} langCode - Language code
 * @returns {string} - Full language name
 */
function getFullLangName(langCode) {
  const code = normalizeLangCode(langCode);
  if (code === "vi") return "Vietnamese";
  if (code === "en") return "English";
  if (code === "zh-tw") return "Traditional Chinese";
  return langCode;
}

/**
 * Normalizes text by cleaning special characters and handling language-specific rules
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized text
 */
function normalize(text = "") {
  const cleaned = text.normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\s]/gu, "").trim();
  return /[\u4e00-\u9fa5]/.test(cleaned) ? cleaned : cleaned.toLowerCase();
}

export {
  detectSourceLanguage,
  normalizeLangCode,
  getFullLangName,
  normalize
};
