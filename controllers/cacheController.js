import SemanticCache from "../models/SemanticCache.js";
import logger from "../services/loggerService.js";
import { safeCacheSet, CACHE_TTLS } from "../helpers/translationHelper.js";
import { Op } from "sequelize";

export function normalizePagination(page, limit) {
  const currentPage = Number.parseInt(page, 10) || 1;
  const pageSize = Number.parseInt(limit, 10) || 10;
  const offset = (currentPage - 1) * pageSize;
  return { currentPage, pageSize, offset };
}

function cleanInputText(text) {
  if (!text) return "";
  let cleaned = text.trim();
  while (/^(?:latest|unknown|web|api|excel|client|[a-zA-Z0-9_\-\.\/]+-app|[a-zA-Z0-9_\-\.\/]+-rag|[a-zA-Z0-9_\-\.\/]+:(?:latest|unknown)|[a-zA-Z0-9_\-\.]+:[a-zA-Z0-9_\-\.]+):/i.test(cleaned)) {
    const next = cleaned.replace(/^(?:latest|unknown|web|api|excel|client|[a-zA-Z0-9_\-\.\/]+-app|[a-zA-Z0-9_\-\.\/]+-rag|[a-zA-Z0-9_\-\.\/]+:(?:latest|unknown)|[a-zA-Z0-9_\-\.]+:[a-zA-Z0-9_\-\.]+):\s*/i, "");
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned.trim();
}

function parseCacheKey(key) {
  if (!key) return { type: "OTHER", inputText: "", category: "ALL" };

  if (key.startsWith("rag_prompt:")) {
    const rest = key.slice("rag_prompt:".length);
    const lastColon = rest.lastIndexOf(":");
    if (lastColon !== -1) {
      const inputText = cleanInputText(rest.slice(0, lastColon));
      const category = rest.slice(lastColon + 1);
      return { type: "PROMPT", inputText, category: category.trim() };
    }
    return { type: "PROMPT", inputText: cleanInputText(rest), category: "ALL" };
  }

  if (key.startsWith("rag_result:")) {
    const rest = key.slice("rag_result:".length);
    const lastColon = rest.lastIndexOf(":");
    if (lastColon !== -1) {
      const inputText = cleanInputText(rest.slice(0, lastColon));
      const category = rest.slice(lastColon + 1);
      return { type: "RESULT", inputText, category: category.trim() };
    }
    return { type: "RESULT", inputText: cleanInputText(rest), category: "ALL" };
  }

  return { type: "OTHER", inputText: cleanInputText(key), category: "ALL" };
}

/**
 * Admin API: Get list of cached items in SemanticCache with pagination & search
 * Groups related `rag_result` and `rag_prompt` items into unified objects.
 * GET /api/cache
 */
export async function getCacheController(req, res) {
  try {
    const { page = 1, limit = 10, search, targetLang, type } = req.query;
    const { currentPage, pageSize, offset } = normalizePagination(page, limit);

    const whereClause = {};
    if (targetLang) {
      whereClause.targetLang = targetLang;
    }
    if (type) {
      whereClause.type = type;
    }
    if (search && search.trim()) {
      whereClause.key = { [Op.like]: `%${search.trim()}%` };
    }

    const allRecords = await SemanticCache.findAll({
      where: whereClause,
      order: [["id", "DESC"]],
      attributes: ["id", "key", "type", "targetLang", "value", "ttl", "expireAt", "createdAt", "updatedAt"],
    });

    // Group records by (inputText, category, targetLang)
    const groupMap = new Map();

    for (const record of allRecords) {
      const plain = record.get({ plain: true });
      const parsedKey = parseCacheKey(plain.key);
      const langKey = plain.targetLang || "all";
      const groupKey = `${parsedKey.inputText.toLowerCase().trim()}|${parsedKey.category.toLowerCase().trim()}|${langKey.toLowerCase().trim()}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          id: plain.id,
          inputText: parsedKey.inputText,
          category: parsedKey.category,
          targetLang: plain.targetLang,
          result: null,
          prompt: null,
          createdAt: plain.createdAt,
          updatedAt: plain.updatedAt,
        });
      }

      const group = groupMap.get(groupKey);

      if (parsedKey.type === "RESULT") {
        let val = plain.value;
        if (typeof val === "string") {
          try { val = JSON.parse(val); } catch (e) {}
        }
        group.result = {
          id: plain.id,
          key: plain.key,
          translation: typeof val === "object" && val !== null ? val.translation : val,
          model: typeof val === "object" && val !== null ? val.model : parsedKey.model || null,
          ttl: plain.ttl,
          expireAt: plain.expireAt,
          updatedAt: plain.updatedAt,
        };
      } else if (parsedKey.type === "PROMPT") {
        group.prompt = {
          id: plain.id,
          key: plain.key,
          content: plain.value,
          ttl: plain.ttl,
          expireAt: plain.expireAt,
          updatedAt: plain.updatedAt,
        };
      } else {
        group.result = {
          id: plain.id,
          key: plain.key,
          translation: plain.value,
          ttl: plain.ttl,
          expireAt: plain.expireAt,
        };
      }
    }

    const groupedList = Array.from(groupMap.values());
    const totalItems = groupedList.length;
    const paginatedItems = groupedList.slice(offset, offset + pageSize);
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    return res.status(200).json({
      success: true,
      data: {
        totalItems,
        items: paginatedItems,
        totalPages,
        currentPage,
      },
    });
  } catch (error) {
    logger.error("Error fetching cache list:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * Admin API: Delete bad translation cache from SemanticCache
 * DELETE /api/cache
 */
export async function deleteCacheController(req, res) {
  try {
    const { key, id } = req.body || req.query;

    if (!key && !id) {
      return res.status(400).json({ success: false, message: "Must provide 'key' or 'id' to delete cache" });
    }

    const whereClause = {};
    if (id) whereClause.id = id;
    if (key) whereClause.key = { [Op.like]: `%${key}%` };

    const deletedCount = await SemanticCache.destroy({ where: whereClause });

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} cache record(s)`,
      data: { deletedCount },
    });
  } catch (error) {
    logger.error("Error deleting cache:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * Admin API: Direct edit/update translation entry in SemanticCache
 * PUT /api/cache
 */
export async function updateCacheController(req, res) {
  try {
    const { id, key, targetLang, translationText, translations } = req.body;

    if (!id && !key) {
      return res.status(400).json({ success: false, message: "Missing required field: 'id' or 'key'" });
    }
    if (!translationText && !translations) {
      return res.status(400).json({ success: false, message: "Missing required field: 'translationText' or 'translations'" });
    }

    // 1. Direct update by Primary Key ID (Ensures exact row overwrite)
    if (id) {
      const record = await SemanticCache.findByPk(id);
      if (!record) {
        return res.status(404).json({ success: false, message: `Cache record not found for id=${id}` });
      }

      let val = record.value;
      if (typeof val === "string") {
        try { val = JSON.parse(val); } catch (e) {}
      }

      const newTranslation = translationText ? translationText.trim() : (translations ? translations[record.targetLang || "vi"] : "");
      const newValue = typeof val === "object" && val !== null
        ? { ...val, translation: newTranslation, model: "admin-manual-override" }
        : { translation: newTranslation, model: "admin-manual-override" };

      const now = new Date();
      const ttl = CACHE_TTLS.FEEDBACK;
      const expireAt = new Date(now.getTime() + ttl * 1000);

      await record.update({
        value: newValue,
        ttl,
        expireAt,
        updatedAt: now,
      });

      return res.status(200).json({
        success: true,
        message: `Cache ID ${id} updated successfully with 90-day TTL`,
        data: { id: record.id, key: record.key, targetLang: record.targetLang, translation: newTranslation },
      });
    }

    // 2. Direct update by Key string
    const normalizedKey = key.replace(/^rag_result:[^:]+:[^:]+:/, "rag_result:");

    if (translations && typeof translations === "object") {
      for (const [lang, text] of Object.entries(translations)) {
        if (text && typeof text === "string") {
          await safeCacheSet(
            normalizedKey,
            lang,
            { translation: text.trim(), model: "admin-manual-override" },
            CACHE_TTLS.FEEDBACK
          );
        }
      }
      return res.status(200).json({
        success: true,
        message: "Multi-language cache updated successfully with 90-day TTL",
        data: { key: normalizedKey, translations },
      });
    }

    await safeCacheSet(
      normalizedKey,
      targetLang || "vi",
      { translation: translationText.trim(), model: "admin-manual-override" },
      CACHE_TTLS.FEEDBACK
    );

    return res.status(200).json({
      success: true,
      message: "Cache updated successfully with 90-day TTL",
      data: { key: normalizedKey, targetLang, translationText },
    });
  } catch (error) {
    logger.error("Error updating cache:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
