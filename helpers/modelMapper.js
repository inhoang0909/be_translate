/**
 * Convert API model format (qwen3-8b) to Ollama format (qwen3:8b)
 * @param {string} model - Model name from API request
 * @returns {string} - Model name in Ollama format
 */
export function convertModelFormat(model) {
  if (!model) return "qwen3:8b"; // default
  
  // Replace last hyphen with colon for Ollama format
  // qwen3-8b -> qwen3:8b
  // gemma3-12b -> gemma3:12b
  const parts = model.split('-');
  if (parts.length >= 2) {
    const lastPart = parts.pop();
    return `${parts.join('-')}:${lastPart}`;
  }
  
  return model;
}

/**
 * Reverse conversion: Ollama format (qwen3:8b) to API format (qwen3-8b)
 * @param {string} model - Model name from Ollama
 * @returns {string} - Model name in API format
 */
export function convertToAPIFormat(model) {
  if (!model) return "qwen3-8b";
  return model.replace(':', '-');
}