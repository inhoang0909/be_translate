import axios from "axios";
import Url from "../models/Url.js";

let OLLAMA_API_URLS = [];
let apiBusyStatus = [];
let lastUsedIndex = -1;
const requestQueue = [];
const unsupportedModelsByApi = {};

/* Compute queue length dynamically based on available endpoints */
function getMaxQueueLength() {
  return Math.max(20, (OLLAMA_API_URLS.length || 1) * 5);
}

export async function reloadEndpointsFromDB() {
  try {
    console.log("[apiManager] 🔄 Loading endpoints from DB...");
    const rows = await Url.findAll({ order: [["createdAt", "DESC"]] });

    // Only endpoints with active === true
    const activeEndpoints = (rows || [])
      .filter(r => r && (r.active === undefined ? false : !!r.active))
      .map(r => r.endpoint || r.url)
      .filter(Boolean);

    OLLAMA_API_URLS = activeEndpoints;
    apiBusyStatus = OLLAMA_API_URLS.map(() => null);

    // Reset blacklist model khi reload DB
    Object.keys(unsupportedModelsByApi).forEach(k => delete unsupportedModelsByApi[k]);

    console.log(`[apiManager] ✓ Loaded ${OLLAMA_API_URLS.length} active endpoints`);
    return OLLAMA_API_URLS.length;
  } catch (err) {
    console.error("[apiManager] ✗ Failed to load endpoints from DB:", err?.message || err);
    loadFromEnv();
    return OLLAMA_API_URLS.length;
  }
}

function loadFromEnv() {
  console.log("[apiManager] 🔄 Scanning environment variables for endpoints...");
  OLLAMA_API_URLS = Object.keys(process.env)
    .filter(key => key.startsWith("OLLAMA_API_URL_"))
    .map(key => process.env[key])
    .filter(Boolean);

  apiBusyStatus = OLLAMA_API_URLS.map(() => null);
  console.log(`[apiManager] ✓ Loaded ${OLLAMA_API_URLS.length} endpoints from env`);
}

// -------------------- API selection --------------------
export function getAvailableApiIndex() {
  const len = OLLAMA_API_URLS.length;
  if (len === 0) return -1;
  for (let i = 0; i < len; i++) {
    const idx = (lastUsedIndex + 1 + i) % len;
    if (!apiBusyStatus[idx]) {
      lastUsedIndex = idx;
      return idx;
    }
  }
  return -1;
}

export function getApiUrl(index) {
  return OLLAMA_API_URLS[index];
}

export function markApiBusy(index, clientId = "unknown", model = "unknown") {
  apiBusyStatus[index] = {
    busy: true,
    clientId,
    model,
    startedAt: Date.now(),
  };
  console.log(`[apiManager] 🟡 API ${index} marked busy by ${clientId}`);
}

export function markApiFree(index) {
  if (apiBusyStatus[index]) {
    const { clientId, startedAt } = apiBusyStatus[index];
    const duration = Date.now() - startedAt;
    console.log(`[apiManager] 🟢 API ${index} freed by ${clientId} after ${duration}ms`);
  }
  apiBusyStatus[index] = null;
  processQueue(); // Gọi request tiếp theo trong hàng đợi
}

export function logApiStatus() {
  console.log("📊 Current API status:");
  OLLAMA_API_URLS.forEach((url, i) => {
    const status = apiBusyStatus[i];
    let line = ` - API ${i} (${url}): `;
    if (status) {
      const age = Date.now() - status.startedAt;
      line += `BUSY by ${status.clientId}, model: ${status.model}, age: ${age}ms`;
    } else {
      line += `FREE`;
    }
    console.log(line);
  });
  console.log(`Queue: ${requestQueue.length} waiting (max ${getMaxQueueLength()})`);
}

// -------------------- Request queue & execution --------------------
function processQueue() {
  if (requestQueue.length === 0) return;

  for (let qIdx = 0; qIdx < requestQueue.length; qIdx++) {
    const req = requestQueue[qIdx];
    const { payload, resolve, reject } = req;

    // Check if this request has exhausted all APIs
    if (payload.triedApis && payload.triedApis.size >= OLLAMA_API_URLS.length) {
      requestQueue.splice(qIdx, 1);
      qIdx--;
      reject(new Error("All available API endpoints failed or are busy."));
      continue;
    }

    // Find a free API that hasn't been tried and supports the model
    let apiIndex = -1;
    const len = OLLAMA_API_URLS.length;
    for (let i = 0; i < len; i++) {
      const idx = (lastUsedIndex + 1 + i) % len;
      const isUnsupported = unsupportedModelsByApi[idx] && payload.model && unsupportedModelsByApi[idx].has(payload.model);

      if (!apiBusyStatus[idx] && !isUnsupported && (!payload.triedApis || !payload.triedApis.has(idx))) {
        apiIndex = idx;
        lastUsedIndex = idx;
        break;
      }
    }

    if (apiIndex !== -1) {
      // Remove from queue
      requestQueue.splice(qIdx, 1);
      qIdx--;

      markApiBusy(apiIndex, payload.clientId, payload.model);
      if (!payload.triedApis) payload.triedApis = new Set();
      payload.triedApis.add(apiIndex);

      axios.post(getApiUrl(apiIndex), payload.body, {
        signal: payload.signal,
        timeout: payload.timeout || 120000,
        responseType: payload.stream ? 'stream' : 'json' // Hỗ trợ streaming nếu payload có yêu cầu
      })
        .then((res) => {
          markApiFree(apiIndex);

          // Ollama cold-start guard
          if (res.data && res.data.done === false && !res.data.response && !res.data.message?.content) {
            throw new Error(`API ${apiIndex} model cold-loading (done: false, empty response)`);
          }

          resolve(res.data?.response ?? res.data);
        })
        .catch((err) => {
          markApiFree(apiIndex);

          // 404 means model missing on this endpoint
          if (err.response?.status === 404 && payload.model) {
            if (!unsupportedModelsByApi[apiIndex]) unsupportedModelsByApi[apiIndex] = new Set();
            unsupportedModelsByApi[apiIndex].add(payload.model);
            console.warn(`[apiManager] 🚫 API ${apiIndex} does not support model '${payload.model}' (404). Automatically bypassing for this model.`);
          }

          // Abort signals should not retry
          if (axios.isCancel(err) || err.name === 'AbortError' || (payload.signal && payload.signal.aborted)) {
            return reject(err);
          }

          console.warn(`[apiManager] ⚠️ API ${apiIndex} failed (${err.message}). Retrying...`);

          const usableEndpointsCount = OLLAMA_API_URLS.filter((_, idx) => {
            return !unsupportedModelsByApi[idx] || !payload.model || !unsupportedModelsByApi[idx].has(payload.model);
          }).length;

          // Retry logic
          if (payload.triedApis.size < usableEndpointsCount) {
            requestQueue.unshift({ payload, resolve, reject }); // Đẩy lại lên đầu hàng đợi
            processQueue();
          } else {
            console.error(`[apiManager] ❌ Request failed on all compatible APIs.`);
            reject(err);
          }
        });
    }
  }
}

export function queueOrExecuteRequest(payload) {
  return new Promise((resolve, reject) => {
    if ((OLLAMA_API_URLS || []).length === 0) {
      return reject(new Error("No Ollama API endpoints configured (Url table empty and no env endpoints)."));
    }

    if (requestQueue.length >= getMaxQueueLength()) {
      return reject(new Error("All APIs busy and queue is full."));
    }

    payload.triedApis = new Set();
    console.log(`[apiManager] ⏳ Queued request from ${payload.clientId} (queue size: ${requestQueue.length + 1})`);

    requestQueue.push({ payload, resolve, reject });
    processQueue();
  });
}

// Initialize once at module load (Đã xóa dòng bị lặp)
await reloadEndpointsFromDB();