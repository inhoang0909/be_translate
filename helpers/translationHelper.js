import Translation from "../models/Translation.js";
import logger from "../services/loggerService.js";
import cache from "../services/CAG/cacheService.js";
import sequelize from "../config/db.js";

export const DEFAULT_TARGET_LANGS = ["vi", "en", "zh-tw"];
export const CACHE_TTLS = { PROMPT: 60 * 60 * 6, RESULT: 60 * 60 * 24 * 7, FEEDBACK: 60 * 60 * 24 * 90 };
export const DEFAULT_TIMEOUT = 60000;
export const CORRECT_TRANSLATE_TIMEOUT = 75000;
export const ALLOWED_MODELS = ["qwen3-8b", "gemma3-12b", "qwen3-32b", "qwen3.5-latest"];


export function normalizeTargetLangs(targetLangs) {
  return !targetLangs || targetLangs.length === 0 ? DEFAULT_TARGET_LANGS : targetLangs;
}

export async function saveTranslationRecord({ original, corrected = null, detected, targetLangs, translation, source, model, categories = null, ragUsed = false, matchedCategories = null }) {
  try {
    const payload = {
      original,
      correctedInput: corrected || null,
      detected,
      targetLang: Array.isArray(targetLangs) ? targetLangs.join(",") : targetLangs,
      translatedText: JSON.stringify(translation),
      source,
      model,
      categories: categories ? categories.join(",") : null,
      ragUsed: !!ragUsed,
      matchedCategories: matchedCategories ? (Array.isArray(matchedCategories) ? matchedCategories.join(",") : String(matchedCategories)) : null,
    };

    // log payload (truncated) for debugging validation issues
    try { console.log("[saveTranslationRecord] payload:", { original: payload.original?.slice?.(0, 120), targetLang: payload.targetLang, model: payload.model, ragUsed: payload.ragUsed }); } catch (e) { }

    // Ensure we don't accidentally pass an `id` into create (avoids unique constraint errors)
    if (Object.prototype.hasOwnProperty.call(payload, "id")) {
      console.warn("[saveTranslationRecord] stripping unexpected id from payload", payload.id);
      delete payload.id;
    }

    // Also strip common casing variations
    if (Object.prototype.hasOwnProperty.call(payload, "ID")) delete payload.ID;
    if (Object.prototype.hasOwnProperty.call(payload, "Id")) delete payload.Id;

    console.log("[saveTranslationRecord] creating with keys:", Object.keys(payload));
    let record;
    try {
      record = await Translation.create(payload);
    } catch (createErr) {
      if (createErr && createErr.name === 'SequelizeUniqueConstraintError' && sequelize.getDialect() === 'postgres') {
        try {
          const res = await sequelize.query(`SELECT pg_get_serial_sequence('"Translations"','id') AS seq`);
          const seq = res[0]?.[0]?.seq;
          if (seq) {
            await sequelize.query(`SELECT setval('${seq}', (SELECT COALESCE(MAX(id), 0) FROM "Translations"))`);
            console.log(`[db] Repaired sequence ${seq} for Translations and retrying CREATE`);
            record = await Translation.create(payload);
          } else {
            throw createErr;
          }
        } catch (repairErr) {
          console.error(`[db] Failed to repair sequence for Translations:`, repairErr);
          throw createErr;
        }
      } else {
        throw createErr;
      }
    }
    return record;
  } catch (e) {
    // log detailed validation errors when available
    if (e && e.errors && Array.isArray(e.errors)) {
      const details = e.errors.map(x => ({ message: x.message, path: x.path, value: x.value }));
      logger.error("saveTranslationRecord failed - validation errors", { details });
      console.error("[saveTranslationRecord] validation errors:", details);
    } else {
      logger.error("saveTranslationRecord failed", { err: e?.message || e });
      console.error("[saveTranslationRecord] error:", e);
    }
    return null;
  }
}

export function buildResponse(success, message, payload = {}) {
  return { success, message, data: payload };
}

export async function safeCacheGet(key, targetLang = null) {
  try { return await cache.get(key, targetLang); } catch (e) { logger.error("cache.get failed", { key, err: e?.message || e }); return null; }
}
export async function safeCacheSet(key, targetLang, value, ttl) {
  try { await cache.set(key, targetLang, value, ttl); } catch (e) { logger.error("cache.set failed", { key, err: e?.message || e }); }
}
export function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeoutMs)
    ),
  ]);
}

export function normalizeModelInput(m) {
  if (!m) return null;
  return String(m).trim().toLowerCase().replace(/:/g, "-");
}

export function validateBaseInputs(text, targetLangs, model) {
  if (!text) return { ok: false, status: 400, message: "Missing 'text'." };
  if (!Array.isArray(targetLangs) || targetLangs.length === 0) return { ok: false, status: 400, message: "Missing or invalid 'targetLangs' array." };
  if (model && !ALLOWED_MODELS.includes(model)) return { ok: false, status: 400, message: `Invalid model '${model}'. Allowed models are: ${ALLOWED_MODELS.join(", ")}` };
  return { ok: true };
}

export function respondServiceError(res, logger, err, fallbackMessage = "Service failed") {
  logger?.error?.(fallbackMessage, { error: err?.message || err });
  if (err?.message && err.message.includes("timed out")) {
    return res.status(504).json({ success: false, message: "Request timed out", data: null });
  }
  return res.status(502).json({ success: false, message: fallbackMessage, data: null, details: err?.message || err });
}