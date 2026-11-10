import { initDB } from "../../config/vectorDB.js";
import { embed } from "./embedding.js";
import { hashKey, cosineSim, resolveTTL, SIMILARITY_THRESHOLD } from "../../utils/cache.js";
import { Op } from "sequelize";

// ------------------------
// SET CACHE
// ------------------------
export async function setCache(key, targetLang, value, ttl) {
  const SemanticCache = await initDB();

  const finalTTL = resolveTTL(key, ttl);
  const vector = await embed(key);
  const now = new Date();
  const expireAt = new Date(now.getTime() + finalTTL * 1000);

  let cacheType = "RESULT";
  if (key.startsWith("rag_prompt:")) {
    cacheType = "PROMPT";
  } else if (key.startsWith("rag_result:")) {
    cacheType = "RESULT";
  }

  // 1. Try exact match by key + targetLang
  const whereClause = { key };
  if (targetLang) whereClause.targetLang = targetLang;

  let existing = await SemanticCache.findOne({ where: whereClause });

  // 2. Fallback match for rag_result / rag_prompt if exact key differs due to prefixes
  if (!existing && (key.startsWith("rag_result:") || key.startsWith("rag_prompt:"))) {
    const lastColonIndex = key.lastIndexOf(":");
    if (lastColonIndex !== -1) {
      const category = key.slice(lastColonIndex + 1).trim();
      const rest = key.slice(0, lastColonIndex);
      const cleanedInput = rest
        .replace(/^rag_(?:result|prompt):/, "")
        .replace(/^(?:latest|unknown|web|api|excel|client|[a-zA-Z0-9_\-\.\/]+-app|[a-zA-Z0-9_\-\.\/]+-rag|[a-zA-Z0-9_\-\.\/]+:(?:latest|unknown)|[a-zA-Z0-9_\-\.]+:[a-zA-Z0-9_\-\.]+):\s*/i, "")
        .trim();

      if (cleanedInput && category) {
        const candidates = await SemanticCache.findAll({
          where: {
            type: cacheType,
            targetLang: targetLang || null,
          },
          order: [["id", "DESC"]],
        });

        for (const candidate of candidates) {
          if (candidate.key.endsWith(`:${category}`) && candidate.key.includes(cleanedInput)) {
            existing = candidate;
            break;
          }
        }
      }
    }
  }

  if (existing) {
    await existing.update({
      type: cacheType,
      value,
      embedding: vector,
      ttl: finalTTL,
      expireAt,
      updatedAt: now,
    });
    console.log(`[cacheService] Cache UPDATED (${cacheType}, id=${existing.id}): ${existing.key.slice(0, 50)}... ttl=${finalTTL}s expireAt=${expireAt.toISOString()}`);
  } else {
    await SemanticCache.create({
      key,
      type: cacheType,
      targetLang: targetLang || null,
      value,
      embedding: vector,
      createdAt: now,
      ttl: finalTTL,
      expireAt,
    });
    console.log(`[cacheService] Cache SET (${cacheType}): ${key.slice(0, 50)}... ttl=${finalTTL}s expireAt=${expireAt.toISOString()}`);
  }
}

// ------------------------
// GET CACHE (Exact + Vector Search)
// ------------------------
export async function getCache(key, targetLang) {
  const SemanticCache = await initDB();
  const now = new Date();

  // STEP 1: Try EXACT match first by key + targetLang
  const exactWhere = { key, expireAt: { [Op.gt]: now } };
  if (targetLang) exactWhere.targetLang = targetLang;

  const exactMatch = await SemanticCache.findOne({ where: exactWhere });

  if (exactMatch) {
    console.log(`[cacheService] Cache HIT (EXACT): ${key.slice(0, 50)}...`);
    return exactMatch.value; // Access value directly from instance properties
  }

  console.log(`[cacheService] No exact match for: ${key.slice(0, 50)}...`);

  // STEP 2: Semantic search (embedding similarity)
  const queryVector = await embed(key);

  const whereClause = { expireAt: { [Op.gt]: now } };
  if (targetLang) {
    whereClause.targetLang = targetLang;
  }

  // Replaced Mongo find().limit().toArray() with Sequelize findAll()
  const candidates = await SemanticCache.findAll({
    where: whereClause,
    limit: 500
  });

  if (!candidates || candidates.length === 0) {
    console.log("[cacheService] No candidates found in DB");
    return null;
  }

  console.log(`[cacheService] Comparing against ${candidates.length} candidates...`);

  let best = null;
  let bestScore = -1;

  for (const docInstance of candidates) {
    const doc = docInstance.get({ plain: true }); // Get plain object from Sequelize instance

    if (!doc.embedding || !Array.isArray(doc.embedding)) {
      console.warn(`[cacheService] Skipping doc ${doc.id} - invalid embedding`);
      continue;
    }
    const score = cosineSim(queryVector, doc.embedding);
    if (score > bestScore) {
      bestScore = score;
      best = doc;
    }
  }

  console.log(`[cacheService] Top similarity score: ${bestScore.toFixed(4)} (threshold: ${SIMILARITY_THRESHOLD})`);

  if (bestScore < SIMILARITY_THRESHOLD || !best) {
    console.log("[cacheService] No match above threshold");
    return null;
  }

  console.log(`[cacheService] Cache HIT (SEMANTIC): ${best.key.slice(0, 50)}... (score: ${bestScore.toFixed(4)})`);
  return best.value;
}

// ------------------------
// KEY BUILDER
// ------------------------
export function makeKey(...parts) {
  return parts.join("||");
}

export default {
  set: setCache,
  get: getCache,
  makeKey,
};
