import TranslationFeedback from "../models/TranslationFeedback.js";
import Translation from "../models/Translation.js";
import logger from "../services/loggerService.js";
import { safeCacheSet, CACHE_TTLS } from "../helpers/translationHelper.js";
import { normalizePagination } from "./cacheController.js";
import { Op } from "sequelize";

/**
 * Helper to parse correction text if it is JSON object (e.g. {"vi":"...", "zh-tw":"..."}) or string
 */
function parseCorrectionObj(correctionText) {
  if (typeof correctionText === "object" && correctionText !== null) {
    return correctionText;
  }
  if (typeof correctionText === "string") {
    const trimmed = correctionText.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null) {
          return parsed;
        }
      } catch (e) {}
    }
  }
  return null;
}

export async function createFeedbackController(req, res) {
  try {
    const { translationId, rating, userCorrection, comment } = req.body;

    if (!translationId || rating === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: translationId, rating",
      });
    }

    const parsedRating = Number.parseInt(rating, 10);
    if (Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5",
      });
    }

    const translation = await Translation.findByPk(translationId);
    if (!translation) {
      return res.status(404).json({
        success: false,
        message: `Translation not found for translationId=${translationId}`,
      });
    }

    const feedback = await TranslationFeedback.create({
      translationId,
      rating: parsedRating,
      userCorrection,
      comment,
    });

    // Auto-promote feedback with high rating (4-5) & userCorrection to SemanticCache (TTL 90 days)
    if (userCorrection && userCorrection.trim() && parsedRating >= 4) {
      try {
        const categories = translation.categories || "ALL";
        const model = translation.model || "qwen3-8b";
        const source = translation.source || "unknown";
        const originalInput = translation.original;
        const targetLangs = (translation.targetLang || "").split(",").map((s) => s.trim().toLowerCase());

        const cacheKey = `rag_result:${originalInput.slice(0, 200)}:${categories}`;
        const correctionObj = parseCorrectionObj(userCorrection);

        for (const lang of targetLangs) {
          const textForLang = correctionObj ? (correctionObj[lang] || correctionObj[lang.replace("-", "_")] || userCorrection.trim()) : userCorrection.trim();

          await safeCacheSet(
            cacheKey,
            lang,
            { translation: textForLang, model: `${model}-feedback-approved` },
            CACHE_TTLS.FEEDBACK
          );
        }
        console.log(`[feedbackController] Auto-promoted feedback ${feedback.id} to SemanticCache: ${cacheKey}`);
      } catch (cacheErr) {
        logger.error("Failed to auto-promote feedback to SemanticCache:", cacheErr);
      }
    }

    try {
      const synoUrl = process.env.SYNO_CHANNEL_URL || 'http://gmo021.cansportsvg.com/api/v1/syno-channel/send';
      const feedbackBody = `New Translation Feedback\nScore: ${parsedRating}/5\nContent: ${comment || 'No comment'}\nCorrection: ${userCorrection || 'No correction'}\nTranslation ID: ${translationId}`;
      fetch(synoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'VG-TRANS-FEEDBACK',
          body: feedbackBody,
        }),
      }).catch((err) => logger.error("Error sending to Syno Chat:", err));
    } catch (e) {
      logger.error("Failed to execute fetch to Syno Chat:", e);
    }

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: feedback,
    });
  } catch (error) {
    logger.error("Error creating feedback:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function getFeedbackController(req, res) {
  try {
    const { page = 1, limit = 10, rating, search, category } = req.query;
    const { currentPage, pageSize, offset } = normalizePagination(page, limit);

    const query = {};
    if (rating !== undefined) {
      const parsedRating = Number.parseInt(rating, 10);
      if (!Number.isNaN(parsedRating)) {
        query.rating = parsedRating;
      }
    }

    if (search && search.trim()) {
      const cleanSearch = `%${search.trim()}%`;
      query[Op.or] = [
        { userCorrection: { [Op.like]: cleanSearch } },
        { comment: { [Op.like]: cleanSearch } },
      ];
    }

    const translationInclude = {
      model: Translation,
      as: "translation",
      attributes: ["id", "original", "detected", "targetLang", "translatedText", "model", "categories", "ragUsed"],
    };

    if (category && category.trim()) {
      translationInclude.where = {
        categories: { [Op.like]: `%${category.trim()}%` },
      };
    }

    const feedbacks = await TranslationFeedback.findAndCountAll({
      where: query,
      limit: pageSize,
      offset: offset,
      order: [["createdAt", "DESC"]],
      include: [translationInclude],
    });

    const items = feedbacks.rows.map((item) => {
      const plain = item.get({ plain: true });
      let outputText = plain.translation?.translatedText;
      if (outputText) {
        try { outputText = JSON.parse(outputText); } catch (e) {}
      }

      const trans = plain.translation || {};
      const categories = trans.categories || "ALL";
      const model = trans.model || "qwen3-8b";
      const source = trans.source || "unknown";
      const originalInput = trans.original || "";
      const cacheKey = originalInput ? `rag_result:${model}:${source}:${originalInput.slice(0, 200)}:${categories}` : null;

      return {
        ...plain,
        cacheKey,
        translation: plain.translation
          ? {
              id: plain.translation.id,
              input: plain.translation.original,
              detectedLang: plain.translation.detected,
              targetLang: plain.translation.targetLang,
              output: outputText,
              model: plain.translation.model,
              categories: plain.translation.categories,
              ragUsed: plain.translation.ragUsed,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        totalItems: feedbacks.count,
        items,
        totalPages: Math.ceil(feedbacks.count / pageSize),
        currentPage,
      },
    });
  } catch (error) {
    logger.error("Error fetching feedbacks:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function getFeedbackStatsController(req, res) {
  try {
    const feedbacks = await TranslationFeedback.findAll({
      attributes: ["rating"],
    });

    const byRating = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    for (const item of feedbacks) {
      const r = item.rating;
      if (byRating[r] !== undefined) {
        byRating[r] += 1;
        totalRating += r;
      }
    }

    const totalFeedbacks = feedbacks.length;
    const averageRating = totalFeedbacks ? Number((totalRating / totalFeedbacks).toFixed(2)) : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalFeedbacks,
        averageRating,
        byRating,
      },
    });
  } catch (error) {
    logger.error("Error fetching feedback stats:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

/**
 * Admin API: Approve feedback and promote user correction into SemanticCache (TTL 90 days)
 * POST /api/feedback/:id/approve
 */
export async function approveFeedbackController(req, res) {
  try {
    const { overrideCorrection, targetLang } = req.body || {};

    const feedback = await TranslationFeedback.findByPk(id, {
      include: [{ model: Translation, as: "translation" }],
    });

    if (!feedback) {
      return res.status(404).json({ success: false, message: `Feedback not found for id=${id}` });
    }

    const rawCorrection = overrideCorrection || feedback.userCorrection || "";
    const correctionObj = parseCorrectionObj(rawCorrection);

    if (!rawCorrection && !correctionObj) {
      return res.status(400).json({ success: false, message: "No userCorrection available to approve" });
    }

    const trans = feedback.translation || {};
    const categories = trans.categories || "ALL";
    const model = trans.model || "qwen3-8b";
    const source = trans.source || "unknown";
    const originalInput = trans.original || "";

    // If targetLang is explicitly provided in body, use only that language. Otherwise fallback to trans.targetLang
    let targetLangs = [];
    if (targetLang && typeof targetLang === "string" && targetLang.trim()) {
      targetLangs = [targetLang.trim().toLowerCase()];
    } else {
      targetLangs = (trans.targetLang || "vi").split(",").map((s) => s.trim().toLowerCase());
    }

    const cacheKey = `rag_result:${originalInput.slice(0, 200)}:${categories}`;

    for (const lang of targetLangs) {
      const textForLang = correctionObj
        ? (correctionObj[lang] || correctionObj[lang.replace("-", "_")] || String(rawCorrection).trim())
        : String(rawCorrection).trim();

      await safeCacheSet(
        cacheKey,
        lang,
        { translation: textForLang, model: `${model}-admin-approved` },
        CACHE_TTLS.FEEDBACK
      );
    }

    return res.status(200).json({
      success: true,
      message: "Feedback approved and promoted to SemanticCache successfully (TTL: 90 days)",
      data: {
        feedbackId: feedback.id,
        cacheKey,
        approvedTranslation: correctionObj || rawCorrection,
        targetLangs,
        ttlDays: 90,
      },
    });
  } catch (error) {
    logger.error("Error approving feedback:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}