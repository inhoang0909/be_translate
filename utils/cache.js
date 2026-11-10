import crypto from "crypto";

export const DEFAULT_TTL = 60 * 60 * 24 * 14; // 14 days
export const SIMILARITY_THRESHOLD = 0.95;



// TTL policy: if explicit ttl passed (>0) use it, otherwise namespace policy
export function resolveTTL(key, ttl) {
  // treat 0, null, undefined as "no explicit TTL"
  if (typeof ttl === "number" && ttl > 0) return ttl;
  const ns = String(key || "").split("||")[0] || "";
  if (ns === "rag_prompt") {
    // 6 hours .. 24 hours
    return 24 * 3600;
  }
  if (ns === "rag_result") {
    return 7* 24 * 3600;
  }
  return DEFAULT_TTL;
}

export function hashKey(key) {
  return crypto.createHash("sha256").update(String(key)).digest("hex");
}

export function cosineSim(a = [], b = []) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}