// Disabled external logger HTTP calls (removed axios dependency)
const logger = {
  async send(logData) {
    // No-op for external logging
    try {
      console.log("[LOGGER-send-disabled]", logData && (logData.endpoint || "no-endpoint"));
    } catch (e) {
      // swallow
    }
  },
  log: (...args) => console.log("[LOG]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
};

export default logger;
