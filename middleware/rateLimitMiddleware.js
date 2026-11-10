import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: "Too many login attempts, please try again later",
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again later",
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});