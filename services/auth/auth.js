import {
  findByUsernameOrEmpno,
  createUser,
  syncGlobalInfo,
} from "../user/user.js";
import { validateCategories } from "./category.js";
import { verifyGlobalUser } from "./global-auth.js";
import { generateTokens } from "./token.js";

const DEFAULT_ROLE = "user";

export const registerService = async (payload) => {
  const categories = await validateCategories(payload.categories);
  const role = payload.role || DEFAULT_ROLE;
  const language = payload.language || null;

  const identifier = payload.username || payload.empno;
  if (!identifier) throw new Error("username or empno required");

  const exist = await findByUsernameOrEmpno(identifier);
  if (exist) throw new Error("User already exists");

  const user = await createUser({
    ...payload,
    username: identifier,
    categories,
    role,
    language,
  });

  const userPlain = user && typeof user.toJSON === "function" ? user.toJSON() : JSON.parse(JSON.stringify(user));
  if (userPlain && userPlain.password) delete userPlain.password;

  return {
    user: userPlain,
    tokens: generateTokens(userPlain),
  };
};

export const loginService = async (loginPayload) => {

  const globalUser = await verifyGlobalUser(loginPayload);

  // 2. Chỉ check username từ response global
  const user = await findByUsernameOrEmpno(globalUser.username);
  if (!user) {
    throw new Error("User not registered in local system");
  }

  // 3. Local account status
  if (!user.active) {
    throw new Error("Local account deactivated");
  }

  // 4. Sync info nếu cần
  await syncGlobalInfo(user, globalUser);

  const userPlain = user && typeof user.toJSON === "function" ? user.toJSON() : JSON.parse(JSON.stringify(user));
  if (userPlain && userPlain.password) delete userPlain.password;

  return {
    user: userPlain,
    tokens: generateTokens(userPlain),
  };
};
