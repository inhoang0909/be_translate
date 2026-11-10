import jwt from "jsonwebtoken";

export const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      id: user.id,
      empno: user.empno,
      username: user.username,
      categories: user.categories,
      role: user.role,
    },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );

  const refreshToken = jwt.sign(
    { id: user.id, empno: user.empno },
    process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key",
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || "30d" }
  );

  return { accessToken, refreshToken };
};
