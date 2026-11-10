import { translateWithQwen } from "../RAG/qwenService.js";
import parseQwenResponse from "../../helpers/parseResponse.js";
import buildSystemPrompt from "../../helpers/buildPrompt.js";
import buildFallback from "../../helpers/buildFallback.js";
import { normalizeTargetLangs, saveTranslationRecord, buildResponse } from "../../helpers/translationHelper.js";

export async function translateNormal(text, targetLangs = [], model, source) {
  targetLangs = normalizeTargetLangs(targetLangs);
  const systemPrompt = buildSystemPrompt(targetLangs);

  try {
    const raw = await translateWithQwen(text, systemPrompt, model, source);
    const result = parseQwenResponse(raw, targetLangs, text);

    await saveTranslationRecord({
      original: text,
      detected: result.source_language,
      targetLangs,
      translation: result.translation,
      source,
      model,
    });

    return buildResponse(true, "Translation successful", { ...result, model, source });
  } catch (err) {
    const fallback = buildFallback(text, targetLangs);
    await saveTranslationRecord({
      original: text,
      detected: fallback.source_language,
      targetLangs,
      translation: fallback.translation,
      source,
      model: "fallback",
    });
    return buildResponse(false, "Translation failed, fallback result returned", { ...fallback, model: "fallback", source });
  }
}