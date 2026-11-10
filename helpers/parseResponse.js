function detectLanguageFromText(text = "") {
  if (/[\u4e00-\u9fa5]/.test(text)) return "zh-tw";
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return "vi";
  return "en";
}

export default function parseQwenResponse(raw, defaultTargetLangs = ["vi"], inputText = "") {
  try {
    let parsed;
    if (typeof raw === "object" && raw !== null) {
      parsed = raw;
    } else if (typeof raw === "string") {
      const startIndex = raw.indexOf("{");
      const endIndex = raw.lastIndexOf("}");
      if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
        const jsonStr = raw.slice(startIndex, endIndex + 1);
        try {
          parsed = JSON.parse(jsonStr);
        } catch (e) {
          parsed = { translation: raw.trim() };
        }
      } else {
        parsed = { translation: raw.trim() };
      }
    } else {
      throw new Error("Invalid raw input to parseQwenResponse");
    }

    let sourceLanguage = parsed.source_language || parsed.source_lang || parsed.detected_language;
    if (!sourceLanguage || typeof sourceLanguage !== "string") {
      sourceLanguage = detectLanguageFromText(inputText);
    }

    const defaultLang = Array.isArray(defaultTargetLangs) && defaultTargetLangs.length > 0 ? defaultTargetLangs[0] : "vi";
    let translationObj = {};

    const rawTranslation = parsed.translation ?? parsed.translations ?? parsed.result ?? parsed.text;

    if (typeof rawTranslation === "string" && rawTranslation.trim()) {
      translationObj[defaultLang] = rawTranslation.trim();
    } else if (typeof rawTranslation === "object" && rawTranslation !== null) {
      for (const [lang, text] of Object.entries(rawTranslation)) {
        if (typeof text === "string" && text.trim()) {
          translationObj[lang] = text.trim();
        }
      }
    } else {
      // Direct keys in parsed object, e.g. { "vi": "Ố liệu" }
      for (const [key, val] of Object.entries(parsed)) {
        if (["source_language", "matched_categories", "source_lang", "detected_language"].includes(key)) continue;
        if (typeof val === "string" && val.trim()) {
          translationObj[key] = val.trim();
        }
      }
    }

    if (Object.keys(translationObj).length === 0) {
      throw new Error("No valid translation text found in Qwen response");
    }

    let matchedCategories = parsed.matched_categories;
    if (matchedCategories) {
      if (!Array.isArray(matchedCategories)) {
        matchedCategories = [String(matchedCategories)];
      }
      matchedCategories = matchedCategories.map(String).filter(Boolean);
    }

    return {
      source_language: sourceLanguage,
      translation: translationObj,
      ...(matchedCategories ? { matched_categories: matchedCategories } : {}),
    };
  } catch (e) {
    console.error("❌ Failed to parse Qwen response:", raw);
    throw e;
  }
}
