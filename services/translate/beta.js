import { normalizeTargetLangs, saveTranslationRecord, buildResponse, DEFAULT_TIMEOUT, withTimeout, safeCacheGet, safeCacheSet, CACHE_TTLS } from "../../helpers/translationHelper.js";
import buildBetaPrompt from "../../helpers/buildBetaPrompt.js";

import { queueOrExecuteRequest } from "../apiManager.js";
// Beta model configurations
const BETA_MODEL = "demonbyron/HY-MT1.5-7B:latest";

/**
 * Detect source language from text
 */
function detectSourceLanguage(text) {
  if (/[\u4e00-\u9fa5]/.test(text)) return "zh-tw";
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return "vi";
  if (/[а-яА-ЯёЁ]/.test(text)) return "ru";
  return "en";
}

function getFullLanguageName(code) {
  const languageMap = {
    "vi": "Vietnamese",
    "en": "English",
    "zh-tw": "Traditional Chinese"
  };
  return languageMap[code.toLowerCase()] || code;
}

/**
 * Sanitizes and cleans the raw response text returned by Beta LLM model.
 * Removes echoed prompts, system instructions, and unwanted markdown wrappers.
 * @param {string} text - Raw output string from LLM
 * @returns {string} - Cleaned translation string
 */
function sanitizeBetaTranslation(text) {
  if (typeof text !== "string") return text;
  let cleaned = text.trim();

  // 1. Remove markdown code fences if wrapped
  cleaned = cleaned.replace(/^```(?:json|text)?\n?/i, "").replace(/\n?```$/i, "").trim();

  // 2. Remove Vietnamese prompt headers (e.g. **Yêu cầu bắt buộc:** ... **Hướng dẫn cụ thể:**)
  cleaned = cleaned.replace(/\*\*Yêu cầu bắt buộc:\*\*[\s\S]*?\*\*Hướng dẫn cụ thể:\*\*/gi, "");
  cleaned = cleaned.replace(/^.*?(Vui lòng tuân thủ|bảng thuật ngữ|tuyệt đối không được).*?\n/gi, "");

  // 3. Remove Chinese prompt instructions (e.g. 参考下面的翻译：... 不要额外解释：)
  cleaned = cleaned.replace(/参考下面的翻译：[\s\S]*?不要额外解释：\s*/gi, "");
  cleaned = cleaned.replace(/^将以下文本翻译为.*?[：:]\s*/gi, "");
  cleaned = cleaned.replace(/^参考下面的翻译[：:]\s*/gi, "");

  // 4. Remove leftover empty prompt lines or markdown bold headers at start
  cleaned = cleaned.replace(/^(\*\*.*?\*\*\s*)+/gi, "");

  return cleaned.trim();
}

/**
 * Hàm gọi API dùng chung, đã tích hợp logic Auto-Retry 5 lần
 */
async function callBetaAPI(text, targetLanguage, systemPrompt = null, clientId = "beta", maxRetries = 5) {
  const prompt = systemPrompt || `Translate the following segment into ${getFullLanguageName(targetLanguage)}, without additional explanation.\n\n${text}`;

  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const body = {
        model: BETA_MODEL,
        prompt,
        stream: false,
        keep_alive: -1,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          repeat_penalty: 1.15
        }
      };


      // Use apiManager to select an available endpoint or queue the request
      const res = await queueOrExecuteRequest({ body, model: BETA_MODEL, clientId });

      let data = res;
      // apiManager may return raw string or an object with `response`
      if (typeof res === "string") {
        try { data = JSON.parse(res); } catch (e) { data = { response: res }; }
      }

      let generated = null;
      if (typeof data === "string") {
        generated = data;
      } else if (data && typeof data === "object") {
        generated = data.response || data.translation || data.text || data.content || data.message?.content || data.choices?.[0]?.message?.content;

        // If response itself is an object, try extracting nested string property
        if (typeof generated === "object" && generated !== null) {
          generated = generated.content || generated.text || generated.translation || generated.response || null;
        }
      }

      // Nếu kết quả null hoặc không phải string hợp lệ, quăng lỗi để trigger logic catch và retry
      if (!generated || typeof generated !== "string" || !generated.trim()) {
        throw new Error("No translation response from API (Result is null/empty)");
      }

      const cleanedTranslation = sanitizeBetaTranslation(generated) || generated.trim();

      // Nếu có kết quả, trả về ngay lập tức và thoát vòng lặp
      return { success: true, translation: cleanedTranslation };

    } catch (err) {
      lastError = err;
      console.warn(`[Retry] Beta API call failed for ${targetLanguage} (Attempt ${attempt}/${maxRetries}):`, err?.message || err);

      // Nếu chưa đạt maxRetries, delay 1 chút trước khi thử lại (500ms, 1s, 1.5s...)
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 500));
      }
    }
  }

  // Sau 5 lần vẫn thất bại thì mới chấp nhận trả về null
  console.error(`[Failed] Beta API call completely failed for ${targetLanguage} after ${maxRetries} attempts.`);
  return { success: false, translation: null, error: lastError?.message || String(lastError) };
}

// ------------------------------
// RAG variant for Beta model (buildBetaPrompt + demonbyron/HY-MT1.5-7B)
// ------------------------------
export async function translateBetaRAG(text, targetLangs = [], source, categoryNames = [], clientId = "default") {
  targetLangs = normalizeTargetLangs(targetLangs);

  if (!Array.isArray(categoryNames) || categoryNames.length === 0) {
    return buildResponse(false, "Categories are required for Beta RAG translation", null);
  }

  const detectedLang = detectSourceLanguage(text);
  const translation = {};
  let successCount = 0;

  for (const lang of targetLangs) {
    try {
      const resultKey = `rag_result:${text.slice(0, 200)}:${categoryNames.join(",")}`;
      const cached = await safeCacheGet(resultKey, lang);
      const cachedText = cached?.translation || (typeof cached === "string" ? cached : null);
      if (cachedText && cachedText !== "[object Object]" && typeof cachedText === "string") {
        translation[lang] = cachedText;
        successCount++;
        continue;
      }

      const promptKey = `rag_prompt:${text.slice(0, 200)}:${categoryNames.join(",")}`;
      let systemPrompt = await safeCacheGet(promptKey, lang);
      if (!systemPrompt) {
        systemPrompt = await buildBetaPrompt(text, lang, categoryNames);
        await safeCacheSet(promptKey, lang, systemPrompt, CACHE_TTLS.PROMPT);
      }

      // Đã có retry ngầm 5 lần bên trong callBetaAPI
      const res = await callBetaAPI(text, lang, systemPrompt, clientId);
      if (res.success && res.translation) {
        translation[lang] = res.translation;
        successCount++;
        await safeCacheSet(resultKey, lang, { translation: res.translation, model: `${BETA_MODEL}-rag` }, CACHE_TTLS.RESULT);
      } else {
        translation[lang] = null;
      }

      // small delay to avoid flooding the model endpoint
      await new Promise(r => setTimeout(r, 120));
    } catch (err) {
      console.error("translateBetaRAG error for lang", lang, err?.message || err);
      translation[lang] = null;
    }
  }

  const savedRecord = await saveTranslationRecord({
    original: text,
    detected: detectedLang,
    targetLangs,
    translation,
    source,
    model: `${BETA_MODEL}-rag`,
    categories: categoryNames,
    ragUsed: true,
  });

  if (successCount === 0) {
    return buildResponse(false, "Beta RAG translation failed after retries", {
      source_language: detectedLang,
      translation,
      model: `${BETA_MODEL}-rag`,
      source,
      categories: categoryNames,
      translationId: savedRecord?.id
    });
  }

  const message = successCount === targetLangs.length ? "Beta RAG translation successful" : `Beta RAG translation partially successful (${successCount}/${targetLangs.length})`;

  return buildResponse(true, message, {
    source_language: detectedLang,
    translation,
    model: `${BETA_MODEL}-rag`,
    source,
    categories: categoryNames,
    translationId: savedRecord?.id
  });
}

/**
 * Translate using Beta API with language-specific calls
 */
export async function translateBeta(text, targetLangs = [], source, clientId = "default") {
  targetLangs = normalizeTargetLangs(targetLangs);
  const detectedLang = detectSourceLanguage(text);

  try {
    // Make parallel API calls for each target language (mỗi luồng đều tự động retry 5 lần nếu fail)
    const translationPromises = targetLangs.map((lang) =>
      callBetaAPI(text, lang, null, clientId).then((result) => ({
        lang,
        ...result,
      }))
    );

    const translationResults = await Promise.all(translationPromises);

    const translation = {};
    let hasFailures = false;

    for (const result of translationResults) {
      if (result.success && result.translation) {
        translation[result.lang] = result.translation;
      } else {
        translation[result.lang] = null;
        hasFailures = true;
      }
    }

    const successCount = Object.values(translation).filter((t) => t !== null).length;

    const savedRecord = await saveTranslationRecord({
      original: text,
      detected: detectedLang,
      targetLangs,
      translation,
      source,
      model: "beta-hymt1.7b",
    });

    if (successCount === 0) {
      return buildResponse(false, "Beta translation failed after retries", {
        source_language: detectedLang,
        translation,
        model: "beta-hymt1.7b",
        source,
        translationId: savedRecord?.id
      });
    }

    const message = hasFailures
      ? `Beta translation partially successful (${successCount}/${targetLangs.length})`
      : "Beta translation successful";

    return buildResponse(successCount > 0, message, {
      source_language: detectedLang,
      translation,
      model: "beta-hymt1.7b",
      source,
      translationId: savedRecord?.id
    });
  } catch (err) {
    console.error("translateBeta error:", err);

    const failedTranslation = {};
    for (const lang of targetLangs) {
      failedTranslation[lang] = null;
    }

    const savedFailedRecord = await saveTranslationRecord({
      original: text,
      detected: detectSourceLanguage(text),
      targetLangs,
      translation: failedTranslation,
      source,
      model: "beta-hymt1.7b",
    });

    return buildResponse(false, "Beta translation encountered a critical error", {
      source_language: detectSourceLanguage(text),
      translation: failedTranslation,
      model: "beta-hymt1.7b",
      source,
      translationId: savedFailedRecord?.id
    });
  }
}