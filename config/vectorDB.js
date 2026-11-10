import SemanticCache from "../models/SemanticCache.js";

export async function initDB() {
  return SemanticCache;
}

export async function closeDB() {
  // Sequelize manages connection pool.
}
