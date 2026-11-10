const LANGUAGE_MAP = {
  vi: "Vietnamese",
  en: "English", 
  "zh-tw": "Traditional Chinese",
};

export default function buildSystemPrompt(targetLangs = []) {
  const langCodes = targetLangs.join(",");
  
  return `
  JSON only: {"source_language":"<code>",
  "translation":{${targetLangs.map(code => `"${code}":"<text>"`).join(",")}}}.
   Detect: vi/en/zh-tw. Translate to: ${langCodes}. No explanations.`;
}
