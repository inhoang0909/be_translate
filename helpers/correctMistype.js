import axios from "axios";

const CORRECT_MISTYPE_URL = process.env.CORRECT_MISTYPE_URL || "";
const CORRECT_MISTYPE_TOKEN = process.env.CORRECT_MISTYPE_TOKEN || "";

/**
 * Parse the mistype correction API response
 * @param {Object} response - Full API response
 * @returns {string} - Corrected text only
 */
function parseCorrectionResponse(response) {
  try {
    // Navigate: data.outputs.text (which is a JSON string)
    const outputText = response?.data?.outputs?.text;
    
    if (!outputText) {
      console.warn("[CorrectMistype] No output text in response");
      return null;
    }

    // Parse the JSON string to get the corrected field
    const parsed = JSON.parse(outputText);
    const corrected = parsed?.corrected;

    if (!corrected) {
      console.warn("[CorrectMistype] No 'corrected' field found");
      return null;
    }

    console.log("[CorrectMistype] ✓ Parsed corrected text:", corrected);
    return corrected;
  } catch (err) {
    console.error("[CorrectMistype] Failed to parse response:", err.message);
    return null;
  }
}

/**
 * Call the mistype correction API
 * @param {string} text - Original text to check
 * @returns {Promise<string>} - Corrected text or original if failed
 */
export async function correctMistype(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    console.log("[CorrectMistype] Empty or invalid text, skipping");
    return text;
  }

  if (!CORRECT_MISTYPE_URL) {
    console.warn("[CorrectMistype] CORRECT_MISTYPE_URL is not configured in environment variables, skipping");
    return text;
  }

  console.log("[CorrectMistype] Checking text:", text.slice(0, 100));

  try {
    const payload = {
      inputs: {
        text: text
      },
      response_mode: "blocking",
      user: "api-user"
    };

    const response = await axios({
      method: "POST",
      url: CORRECT_MISTYPE_URL,
      data: payload,
      headers: {
        "Authorization": `Bearer ${CORRECT_MISTYPE_TOKEN}`,
        "Content-Type": "application/json"
      },
      timeout: 10000 // 10 second timeout
    });

    console.log("[CorrectMistype] API response status:", response.data?.data?.status);

    // Check if workflow succeeded
    if (response.data?.data?.status !== "succeeded") {
      console.warn("[CorrectMistype] Workflow did not succeed:", response.data?.data?.status);
      return text; // return original text
    }

    // Parse and extract corrected text
    const corrected = parseCorrectionResponse(response.data);
    
    if (corrected && corrected !== text) {
      console.log("[CorrectMistype] ✓ Text corrected");
      console.log("[CorrectMistype]   Original:", text);
      console.log("[CorrectMistype]   Corrected:", corrected);
      return corrected;
    }

    console.log("[CorrectMistype] No correction needed");
    return text;

  } catch (err) {
    console.error("[CorrectMistype] API call failed:", err.message);
    
    // If API fails, return original text (graceful degradation)
    return text;
  }
}

/**
 * Check if mistype correction is enabled
 * @returns {boolean}
 */
export function isMistypeCheckEnabled() {
  return !!(CORRECT_MISTYPE_URL && CORRECT_MISTYPE_TOKEN);
}