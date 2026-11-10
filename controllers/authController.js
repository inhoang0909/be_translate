import {
  registerService,
  loginService,
} from "../services/auth/auth.js";

export const register = async (req, res) => {
  try {
    const result = await registerService(req.body);
    res.status(201).json({
      success: true,
      message: "Registered successfully",
      data: result,
    });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await loginService({ username, password });

    // redact raw password from request object so downstream loggers don't store it
    try {
      if (req && req.body && req.body.password) req.body.password = "[REDACTED]";
    } catch (e) {
      // ignore
    }

    res.json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (e) {
    res.status(401).json({
      success: false,
      message: e.message,
    });
  }
};
