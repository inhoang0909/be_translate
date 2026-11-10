import { translateWithQwen } from "../RAG/qwenService.js";
import parseQwenResponse from "../../helpers/parseResponse.js";
import buildSystemPrompt from "../../helpers/buildPrompt.js";
import buildFallback from "../../helpers/buildFallback.js";
import { correctMistype, isMistypeCheckEnabled } from "../../helpers/correctMistype.js";
import { normalizeTargetLangs, saveTranslationRecord, buildResponse } from "../../helpers/translationHelper.js";

export async function translateWithCorrectMistype(text, targetLangs = [], model, source) {
  targetLangs = normalizeTargetLangs(targetLangs);
  const original = text;
  let corrected = null;

  if (isMistypeCheckEnabled()) {
    try {
      const c = await correctMistype(text);
      if (c && c !== text) { corrected = c; text = c; }
    } catch (e) { /* degrade to original text on error */ }
  }

  const systemPrompt = buildSystemPrompt(targetLangs);
  try {
    const raw = await translateWithQwen(text, systemPrompt, model, source);
    const result = parseQwenResponse(raw, targetLangs, text);

    await saveTranslationRecord({
      original,
      corrected,
      detected: result.source_language,
      targetLangs,
      translation: result.translation,
      source,
      model,
    });

    return buildResponse(true, "Translation successful", { ...result, model, source, originalInput: original, correctedInput: corrected });
  } catch (err) {
    const fallback = buildFallback(text, targetLangs);
    await saveTranslationRecord({
      original,
      corrected,
      detected: fallback.source_language,
      targetLangs,
      translation: fallback.translation,
      source,
      model: "fallback",
    });
    return buildResponse(false, "Translation failed, fallback result returned", { ...fallback, model: "fallback", source, originalInput: original, correctedInput: corrected });
  }
}