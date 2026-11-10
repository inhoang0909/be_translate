/**
 * Import Services
 * Language utilities from languageService
 * Vocabulary search from vocabularyRelevanceService
 */
import {
  detectSourceLanguage,
  normalizeLangCode,
  getFullLangName
} from "../services/beta/languageService.js";
import { getRelevantVocab } from "../services/beta/vocabularyRelevanceService.js";
/**
 * Build Beta Prompt with Vocabulary Context
 * 
 * Orchestrates the vocabulary search and prompt building process
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @param {Array<string>} categoryNames - Category filters
 * @param {number} maxVocabItems - Maximum vocabulary items to include
 * @returns {Promise<string>} - Generated system prompt
 */
async function buildBetaPrompt(
  text,
  targetLang = "en",
  categoryNames = [],
  maxVocabItems = 8
) {
  // Retrieve relevant vocabulary using hybrid search
  const vocabs = await getRelevantVocab(text, categoryNames, [targetLang], maxVocabItems);

  // Detect source language from input text
  const detectedSourceCode = normalizeLangCode(detectSourceLanguage(text));
  const targetCode = normalizeLangCode(targetLang);
  const targetFullName = getFullLangName(targetLang);

  // Build vocabulary translation terms for the prompt
  const vocabularyTerms = buildVocabularyTerms(
    vocabs,
    detectedSourceCode,
    targetCode
  );

  // Generate final prompt
  return generatePrompt(text, vocabularyTerms, targetFullName, detectedSourceCode, targetCode);
}

/**
 * Builds vocabulary translation terms from list of vocabularies
 * @param {Array} vocabs - Vocabulary objects with translations
 * @param {string} detectedSourceCode - Detected source language code
 * @param {string} targetCode - Target language code
 * @returns {string} - Formatted vocabulary terms
 */
function buildVocabularyTerms(vocabs, detectedSourceCode, targetCode) {
  const terms = [];
  const seenSource = new Set();

  vocabs.forEach((vocab) => {
    const dict = {};
    vocab.VocabularyTranslations.forEach((translation) => {
      dict[normalizeLangCode(translation.language)] = translation.text;
    });

    const availableLangs = Object.keys(dict);

    let sourceCode;
    if (detectedSourceCode !== targetCode && availableLangs.includes(detectedSourceCode)) {
      sourceCode = detectedSourceCode;
    } else {
      sourceCode = availableLangs.find(lang => lang !== targetCode) || 'en';
    }

    const sourceTerm = dict[sourceCode];
    const targetTerm = dict[targetCode];

    if (sourceTerm && targetTerm && sourceTerm.trim() !== targetTerm.trim()) {
      const cleanSource = sourceTerm.trim();
      const cleanTarget = targetTerm.trim();

      if (!seenSource.has(cleanSource.toLowerCase())) {
        seenSource.add(cleanSource.toLowerCase());
        terms.push(`${cleanSource} 翻译成 ${cleanTarget}`);
      }
    }
  });

  return terms.length > 0 ? `参考下面的翻译：\n${terms.join("\n")}` : "";
}

/**
 * Generates the final system prompt with vocabulary context
 * @param {string} text - Text to translate
 * @param {string} vocabularyTerms - Formatted vocabulary terms
 * @param {string} targetLangName - Full target language name
 * @param {string} sourceCode - Source language code
 * @param {string} targetCode - Target language code
 * @returns {string} - Final system prompt
 */
function generatePrompt(text, vocabularyTerms, targetLangName, sourceCode, targetCode) {
  let prompt = "";
  if (vocabularyTerms) {
    prompt = `${vocabularyTerms}\n将以下文本翻译为${targetLangName}，注意只需要输出翻译后的结果，不要额外解释：\n${text.trim()}`;
  } else {
    prompt = `将以下文本翻译为${targetLangName}，注意只需要输出翻译后的结果，不要额外解释：\n${text.trim()}`;
  }

  console.log("[buildBetaPrompt] Generated prompt:", prompt);
  return prompt;
}
export default buildBetaPrompt;