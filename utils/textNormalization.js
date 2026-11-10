/**
 * Text normalization utilities for fuzzy search
 * Removes diacritics and standardizes text for pg_trgm matching
 */

/**
 * Strip diacritics from text (removes accents, tildes, etc.)
 * Converts "café" to "cafe", "naïve" to "naive", etc.
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized text without diacritics
 */
export function stripDiacritics(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .normalize('NFD')                           // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '')            // Remove diacritical marks
    .toLowerCase()                              // Convert to lowercase
    .trim();                                    // Remove leading/trailing whitespace
}

/**
 * Normalize text for search: removes diacritics, extra spaces, and non-alphanumeric chars
 * Used for both data storage (textSearch field) and query normalization
 * Handles Vietnamese special characters: Đ/đ that don't decompose with NFD
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized text
 */
export function normalizeForSearch(text) {
  if (!text || typeof text !== 'string') return '';
  
  return stripDiacritics(text)
    .replace(/đ/g, 'd')                         // Handle Vietnamese đ (NFD doesn't decompose it)
    .replace(/Đ/g, 'D')                         // Handle Vietnamese Đ
    .replace(/[^\w\s\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, '') // Remove special characters except CJK & alphanumeric
    .replace(/\s+/g, ' ')                       // Collapse multiple spaces
    .trim();
}

/**
 * Normalize text for pg_trgm GIN index matching
 * Keeps spaces and basic punctuation for trigram matching
 * @param {string} text - Text to normalize
 * @returns {string} - Text normalized for trigram search
 */
export function normalizeTrgm(text) {
  if (!text || typeof text !== 'string') return '';
  
  return stripDiacritics(text)
    .replace(/\s+/g, ' ')                       // Collapse multiple spaces
    .trim();
}

export default {
  stripDiacritics,
  normalizeForSearch,
  normalizeTrgm
};
