import express from "express";
import { login,register } from "../controllers/authController.js";
import { authLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user with categories
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - empno
 *               - categories
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john.doe"
 *               empno:
 *                 type: string
 *                 example: "047660"
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["HR", "PCC"]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request or invalid categories
 *       409:
 *         description: User already exists
 */
router.post("/register", authLimiter, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login - validates local DB password then global API
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john.doe"
 *               password:
 *                 type: string
 *                 example: "SecurePass123"
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", authLimiter, login);


export default router;