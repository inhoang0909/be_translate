const activeRequests = new Map();

export function handleSpamRequest(clientId, controller, SPAM_THRESHOLD_MS = 4000) {
  const now = Date.now();
  const existing = activeRequests.get(clientId);

  if (existing) {
    for (const req of existing) {
      const age = now - req.start;
      if (!req.controller.signal.aborted && age > SPAM_THRESHOLD_MS) {
        console.warn(`[QwenService] 🛑 Aborting slow request (${age}ms) for ${clientId}.`);
        req.controller.abort();
      }
    }
    existing.push({ controller, start: now });
  } else {
    activeRequests.set(clientId, [{ controller, start: now }]);
  }
}

export function cleanupRequest(clientId, controller) {
  const existing = activeRequests.get(clientId);
  if (!existing) return;

  const updated = existing.filter(req => req.controller !== controller);
  if (updated.length > 0) {
    activeRequests.set(clientId, updated);
  } else {
    activeRequests.delete(clientId);
  }
}
