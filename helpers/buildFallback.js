export default function buildFallback(text, targetLangs = []) {
  return {
    source_language: "",
    original_text: text,
    translation: targetLangs.reduce((acc, lang) => {
      acc[lang] = null;
      return acc;
    }, {})
  };
}
