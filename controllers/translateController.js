import { translateNormal, translateWithRAG, translateWithCorrectMistype, translateBeta, translateBetaRAG } from "../services/translateService.js";
import logger from "../services/loggerService.js";
import { convertModelFormat } from "../helpers/modelMapper.js";
import {
  withTimeout,
  normalizeModelInput,
  validateBaseInputs,
  respondServiceError,
  CORRECT_TRANSLATE_TIMEOUT,
} from "../helpers/translationHelper.js";

// Normal translation controller
export async function translateController(req, res) {
  const { text, targetLangs, model, source } = req.body;
  const normalizedModel = normalizeModelInput(model) || "qwen3-8b";
  const clientId = req.user?.id || "anonymous";

  const validation = validateBaseInputs(text, targetLangs, normalizedModel);
  if (!validation.ok) return res.status(validation.status).json({ success: false, message: validation.message, data: null });

  const ollamaModel = convertModelFormat(normalizedModel);
  logger.log("Normal translation request", { text: text?.slice(0, 120), targetLangs, source, model: normalizedModel, ollamaModel, clientId });

  try {
    const result = await withTimeout(translateNormal(text, targetLangs, ollamaModel, source, clientId));
    return res.json(result);
  } catch (err) {
    return respondServiceError(res, logger, err, "Translation failed");
  }
}

// Normal translation controller for a single target language
export async function translateSingleController(req, res) {
  const { text, targetLang, model, source } = req.body;
  const normalizedModel = normalizeModelInput(model) || "qwen3-8b";

  if (!targetLang || typeof targetLang !== "string") {
    return res.status(400).json({ success: false, message: "Missing or invalid 'targetLang'. Please provide a language code string.", data: null });
  }

  const targetLangs = [targetLang];
  const validation = validateBaseInputs(text, targetLangs, normalizedModel);
  if (!validation.ok) return res.status(validation.status).json({ success: false, message: validation.message, data: null });

  const ollamaModel = convertModelFormat(normalizedModel);
  logger.log("Single target translation request", { text: text?.slice(0, 120), targetLang, source, model: normalizedModel, ollamaModel });

  try {
    const result = await withTimeout(translateNormal(text, targetLangs, ollamaModel, source));
    return res.json(result);
  } catch (err) {
    return respondServiceError(res, logger, err, "Translation failed");
  }
}

// RAG translation controller
export async function translateRAGController(req, res) {
  const { text, targetLangs, model, source, categories } = req.body;
  if (!Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ success: false, message: "Missing or invalid 'categories' array. Categories are required for RAG translation.", data: null });
  }

  const normalizedModel = normalizeModelInput(model) || "qwen3-8b";
  const clientId = req.user?.id || "anonymous";
  const validation = validateBaseInputs(text, targetLangs, normalizedModel);
  if (!validation.ok) return res.status(validation.status).json({ success: false, message: validation.message, data: null });

  const ollamaModel = convertModelFormat(normalizedModel);
  logger.log("RAG translation request", { text: text?.slice(0, 120), targetLangs, source, model: normalizedModel, categories, clientId });

  try {
    const result = await withTimeout(translateWithRAG(text, targetLangs, ollamaModel, source, categories, clientId));
    return res.json(result);
  } catch (err) {
    return respondServiceError(res, logger, err, "RAG translation failed");
  }
}

// Correct + Translate controller
export async function correctAndTranslateController(req, res) {
  const { text, targetLangs, model, source } = req.body;
  const normalizedModel = normalizeModelInput(model) || "qwen3-8b";
  const clientId = req.user?.id || "anonymous";

  const validation = validateBaseInputs(text, targetLangs, normalizedModel);
  if (!validation.ok) return res.status(validation.status).json({ success: false, message: validation.message, data: null });

  const ollamaModel = convertModelFormat(normalizedModel);
  logger.log("Correct + Translate request", { text: text?.slice(0, 120), targetLangs, source, model: normalizedModel, ollamaModel, clientId });

  try {
    const result = await withTimeout(translateWithCorrectMistype(text, targetLangs, ollamaModel, source, clientId), CORRECT_TRANSLATE_TIMEOUT);
    return res.json(result);
  } catch (err) {
    return respondServiceError(res, logger, err, "Correct + Translate failed");
  }
}

// Beta translation controller (uses new model: demonbyron/HY-MT1.5-7B via ollama)
export async function betaTranslateController(req, res) {
  const { text, targetLangs, source } = req.body;
  const clientId = req.user?.id || "anonymous";

  if (!text) {
    return res.status(400).json({ success: false, message: "Missing 'text'.", data: null });
  }

  if (!Array.isArray(targetLangs) || targetLangs.length === 0) {
    return res.status(400).json({ success: false, message: "Missing or invalid 'targetLangs' array.", data: null });
  }

  logger.log("Beta translation request", { text: text?.slice(0, 120), targetLangs, source, clientId });

  try {
    const result = await withTimeout(translateBeta(text, targetLangs, source, clientId));
    return res.json(result);
  } catch (err) {
    return respondServiceError(res, logger, err, "Beta translation failed");
  }
}

// Beta RAG translation controller (demonbyron/HY-MT1.5-7B + buildBetaPrompt)
export async function betaRagTranslateController(req, res) {
  const { text, targetLangs, source, categories } = req.body;
  const clientId = req.user?.id || "anonymous";
  if (!Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ success: false, message: "Missing or invalid 'categories' array. Categories are required for Beta RAG translation.", data: null });
  }

  if (!text) return res.status(400).json({ success: false, message: "Missing 'text'.", data: null });
  if (!Array.isArray(targetLangs) || targetLangs.length === 0) return res.status(400).json({ success: false, message: "Missing or invalid 'targetLangs' array.", data: null });

  logger.log("Beta RAG translation request", { text: text?.slice(0, 120), targetLangs, source, categories, clientId });

  try {
    const result = await withTimeout(translateBetaRAG(text, targetLangs, source, categories, clientId));
    return res.json(result);
  } catch (err) {
    return respondServiceError(res, logger, err, "Beta RAG translation failed");
  }
}
