import { translateWithQwen } from "../RAG/qwenService.js";
import parseQwenResponse from "../../helpers/parseResponse.js";
import buildCategoryPrompt from "../../helpers/buildCategoryPrompt.js";
import { normalizeTargetLangs, saveTranslationRecord, buildResponse, safeCacheGet, safeCacheSet, CACHE_TTLS } from "../../helpers/translationHelper.js";

// Hàm hỗ trợ delay giữa các lần retry
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function translateWithRAG(text, targetLangs = [], model, source, categoryNames = []) {
  targetLangs = normalizeTargetLangs(targetLangs);
  if (!Array.isArray(categoryNames) || categoryNames.length === 0) {
    return buildResponse(false, "Categories are required for RAG translation", null);
  }

  const targetLangsStr = targetLangs.join(",");
  const resultKey = `rag_result:${text.slice(0, 200)}:${categoryNames.join(",")}`;
  const cached = await safeCacheGet(resultKey, targetLangsStr);
  if (cached) return buildResponse(true, "RAG translation (cached)", { ...cached, model, source, ragUsed: true, cached: true });

  const promptKey = `rag_prompt:${text.slice(0, 200)}:${categoryNames.join(",")}`;
  let systemPrompt = await safeCacheGet(promptKey, targetLangsStr);
  if (!systemPrompt) {
    systemPrompt = await buildCategoryPrompt(text, targetLangs, categoryNames);
    await safeCacheSet(promptKey, targetLangsStr, systemPrompt, CACHE_TTLS.PROMPT);
  }

  const augmentedPrompt = ["### CONTEXT (cached terms / examples) - use these EXACTLY if applicable:", systemPrompt, "", "### INPUT", text].join("\n");

  const MAX_RETRIES = 5;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await translateWithQwen(text, augmentedPrompt, model, source);
      const result = parseQwenResponse(raw, targetLangs, text);

      const savedRecord = await saveTranslationRecord({
        original: text,
        detected: result.source_language,
        targetLangs,
        translation: result.translation,
        source,
        model,
        categories: categoryNames,
        ragUsed: true,
        matchedCategories: result.matched_categories || null,
      });

      await safeCacheSet(resultKey, targetLangsStr, { ...result, categories: categoryNames, ragUsed: true, translationId: savedRecord?.id }, CACHE_TTLS.RESULT);
      
      return buildResponse(true, "RAG translation successful", { ...result, model, source, categories: categoryNames, ragUsed: true, cached: false, translationId: savedRecord?.id });
      
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        // Log lỗi sau 5 lần thất bại
        console.error(`[translateWithRAG] Giao tiếp API thất bại sau ${MAX_RETRIES} lần thử cho đoạn text: "${text}". Chi tiết lỗi:`, err);
        return buildResponse(false, `RAG translation failed after ${MAX_RETRIES} attempts`, null);
      }
      
      // Ghi log cảnh báo và đợi 1s trước khi thử lại (có thể bỏ dòng delay nếu không cần)
      console.warn(`[translateWithRAG] Lần thử thứ ${attempt} thất bại. Đang thử lại...`);
      await delay(1000); 
    }
  }
}