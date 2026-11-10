import axios from "axios";

const GLOBAL_API_URL = process.env.GLOBAL_API_URL || null;

export const verifyGlobalUser = async (loginPayload) => {
  const res = await axios.post(
    GLOBAL_API_URL,
    loginPayload,
    { timeout: 10000 }
  );  

  const data = res.data;

  if (!data || data === "wrong") {
    throw new Error("Global authentication failed");
  }

  if (!data.username) {
    throw new Error("Global response missing username");
  }

  if (data.active !== 1 && data.active !== "1") {
    throw new Error("Global account deactivated");
  }

  return data;
};
