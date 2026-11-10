import axios from "axios";

const MODEL_NAME = process.env.EMBED_MODEL_NAME || "embeddinggemma:latest";

// Accept single URL or comma-separated list of Ollama embedding endpoints
const RAW_URLS = process.env.OLLAMA_EMBED_URL || "";

const EMBED_URLS = RAW_URLS.split(",").map(u => u.trim()).filter(Boolean);
let lastIndex = -1;

function getNextUrl() {
  if (EMBED_URLS.length === 0) throw new Error("No embedding endpoint configured. Please set OLLAMA_EMBED_URL in .env");
  lastIndex = (lastIndex + 1) % EMBED_URLS.length;
  return EMBED_URLS[lastIndex];
}

/**
 * Call Ollama embedding endpoint over HTTP.
 * Tries a few possible response shapes and returns the embedding vector (Array<number>).
 */
export async function embed(text) {
  const url = getNextUrl();
  const payload = {
    model: MODEL_NAME,
    input: text,   // Dành cho chuẩn OpenAI / Ollama đời mới
    prompt: text,  // Thêm dòng này: Dành cho chuẩn Ollama /api/embeddings đời cũ
  };

  const t0 = performance?.now?.() ?? Date.now();
  try {
    const res = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: Number(process.env.EMBED_REQUEST_TIMEOUT_MS) || 30_000,
    });

    const t1 = performance?.now?.() ?? Date.now();
    console.log(`[embedding] HTTP ${url} elapsed ${(t1 - t0).toFixed(1)} ms`);

    const data = res?.data || {};
    
    // DEBUG: In ra cấu trúc thật mà Server AI trả về (cắt bớt cho đỡ dài)
    // console.log(`[DEBUG API] Raw Response cho "${text}":`, JSON.stringify(data).substring(0, 150));

    // 1. Chuẩn OpenAI (vLLM, LM Studio, API xịn...)
    if (data?.data && Array.isArray(data.data) && data.data[0]?.embedding) {
      return data.data[0].embedding;
    }
    // 2. Chuẩn Ollama (/api/embeddings)
    if (Array.isArray(data?.embedding)) {
      if (data.embedding.length === 0) throw new Error("API trả về mảng rỗng!");
      return data.embedding;
    }
    // 3. Các chuẩn khác
    if (Array.isArray(data?.embeddings) && data.embeddings.length > 0) return data.embeddings[0];
    if (Array.isArray(data)) {
        if (data.length === 0) throw new Error("API trả về mảng rỗng!");
        return data; 
    }
    if (Array.isArray(data?.result?.embedding)) return data.result.embedding;

    throw new Error("Không nhận diện được cấu trúc trả về: " + JSON.stringify(data).substring(0, 100));
  } catch (err) {
    const t1 = performance?.now?.() ?? Date.now();
    console.error(`[embedding] Error calling ${url} after ${(t1 - t0).toFixed(1)} ms:`, err?.message || err);
    throw err;
  }
}

export default { embed };