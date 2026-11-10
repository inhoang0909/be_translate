import express from "express";
import { translateController, translateSingleController, translateRAGController, correctAndTranslateController, betaTranslateController, betaRagTranslateController } from "../controllers/translateController.js";


const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Translation
 *   description: Translation API
 */

/**
 * @swagger
 * /api/translate-normal:
 *   post:
 *     summary: Normal translation without RAG
 *     tags: [Translation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - targetLangs
 *             properties:
 *               text:
 *                 type: string
 *                 description: The input text to be translated.
 *                 example: Xin chào, bạn có khỏe không?
 *               targetLangs:
 *                 type: array
 *                 description: Array of language codes to translate into.
 *                 items:
 *                   type: string
 *                 example: [ "en", "zh-tw" ]
 *               model:
 *                 type: string
 *                 description: The model to use for translation.
 *                 example: qwen3-8b
 *                 enum: [ "qwen3-8b", "gemma3-12b", "qwen3-32b" ]
 *               source:
 *                 type: string
 *                 description: The source of the translation request.
 *                 example: web
 *     responses:
 *       200:
 *         description: Successful translation
 *       400:
 *         description: Bad request
 *       502:
 *         description: Translation service error
 */
router.post("/api/translate-normal", translateController);

/**
 * @swagger
 * /api/translate-single:
 *   post:
 *     summary: Translate text into a single target language
 *     tags: [Translation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - targetLang
 *             properties:
 *               text:
 *                 type: string
 *                 description: The input text to be translated.
 *                 example: Xin chào, bạn có khỏe không?
 *               targetLang:
 *                 type: string
 *                 description: Language code to translate into (single value).
 *                 example: "en"
 *               model:
 *                 type: string
 *                 description: The model to use for translation.
 *                 example: qwen3-8b
 *                 enum: [ "qwen3-8b", "gemma3-12b", "qwen3-32b" ]
 *               source:
 *                 type: string
 *                 description: The source of the translation request.
 *                 example: web
 *     responses:
 *       200:
 *         description: Successful translation
 *       400:
 *         description: Bad request
 *       502:
 *         description: Translation service error
 */
router.post("/api/translate-single", translateSingleController);


/**
 * @swagger
 * /api/translate-rag:
 *   post:
 *     summary: RAG-enhanced translation with category selection
 *     tags: [Translation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - targetLangs
 *               - categories
 *             properties:
 *               text:
 *                 type: string
 *                 description: The input text to be translated.
 *                 example: Công đoàn là tổ chức của người lao động
 *               targetLangs:
 *                 type: array
 *                 description: Array of language codes to translate into.
 *                 items:
 *                   type: string
 *                 example: [ "en" ]
 *               categories:
 *                 type: array
 *                 description: Category names for RAG-enhanced translation (REQUIRED).
 *                 items:
 *                   type: string
 *                 example: ["HR", "PCC"]
 *               model:
 *                 type: string
 *                 description: The model to use for translation.
 *                 example: qwen3-8b
 *                 enum: [ "qwen3-8b", "qwen3-14b", "qwen3-32b" ]
 *               source:
 *                 type: string
 *                 description: The source of the translation request.
 *                 example: hrm
 *     responses:
 *       200:
 *         description: Successful RAG translation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: RAG translation successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     source_language:
 *                       type: string
 *                       example: vi
 *                     translation:
 *                       type: object
 *                       example:
 *                         en: "Trade union is an organization of workers"
 *                     model:
 *                       type: string
 *                       example: qwen3:8b
 *                     source:
 *                       type: string
 *                       example: hrm
 *                     ragUsed:
 *                       type: boolean
 *                       example: true
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["HR", "PCC"]
 *       400:
 *         description: Bad request (missing categories)
 *       502:
 *         description: Translation service error
 */
router.post("/api/translate-rag", translateRAGController);

/**
 * @swagger
 * /api/translate:
 *   post:
 *     summary: Correct typos in text then translate
 *     tags: [Translation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - targetLangs
 *             properties:
 *               text:
 *                 type: string
 *                 description: The input text to be corrected and translated.
 *                 example: Sữa chữa máy lạnh vì tiếng nổ lớn.
 *               targetLangs:
 *                 type: array
 *                 description: Array of language codes to translate into.
 *                 items:
 *                   type: string
 *                 example: [ "en", "zh-tw" ]
 *               model:
 *                 type: string
 *                 description: The model to use for translation.
 *                 example: qwen3-8b
 *                 enum: [ "qwen3-8b", "gemma3-12b", "qwen3-32b" ]
 *               source:
 *                 type: string
 *                 description: The source of the translation request.
 *                 example: web
 *     responses:
 *       200:
 *         description: Successful correction and translation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Translation successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     source_language:
 *                       type: string
 *                       example: vi
 *                     translation:
 *                       type: object
 *                       example:
 *                         en: "Fix the air conditioner due to a loud noise."
 *                         zh-tw: "因有巨響而修復冷氣機"
 *                     model:
 *                       type: string
 *                       example: qwen3:8b
 *                     source:
 *                       type: string
 *                       example: web
 *                     correctionApplied:
 *                       type: boolean
 *                       example: true
 *                     originalInput:
 *                       type: string
 *                       example: Sữa chữa máy lạnh vì tiếng nổ lớn.
 *                     correctedInput:
 *                       type: string
 *                       example: sửa chữa máy lạnh vì tiếng nổ lớn.
 *       400:
 *         description: Bad request
 *       503:
 *         description: Mistype correction service not configured
 *       504:
 *         description: Request timed out
 *       502:
 *         description: Service error
 */
router.post("/api/translate", correctAndTranslateController);

/**
 * @swagger
 * /api/translate-beta:
 *   post:
 *     summary: Beta translation using HY-MT1.5-7B model via Ollama
 *     tags: [Translation]
 *     description: Translation using the new demonbyron/HY-MT1.5-7B model. Note - Makes separate calls per language.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - targetLangs
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to translate
 *                 example: "Hello, are you okay?"
 *               targetLangs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Target languages for translation
 *                 example: ["en", "zh-tw"]
 *               source:
 *                 type: string
 *                 description: Source/context identifier
 *                 example: "chat"
 *     responses:
 *       200:
 *         description: Translation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     source_language:
 *                       type: string
 *                       example: "vi"
 *                     translation:
 *                       type: object
 *                       example:
 *                         en: "Hello, are you okay?"
 *                         zh-tw: "你好，你還好嗎？"
 *                     model:
 *                       type: string
 *                       example: "beta-hmt1.5"
 *                     source:
 *                       type: string
 *       400:
 *         description: Missing required fields
 *       504:
 *         description: Request timed out
 *       502:
 *         description: Service error
 */
router.post("/api/translate-beta", betaTranslateController);

/**
 * @swagger
 * /api/translate-beta-rag:
 *   post:
 *     summary: Beta RAG translation using demonbyron/HY-MT1.5-7B with category prompts
 *     tags: [Translation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - targetLangs
 *               - categories
 *             properties:
 *               text:
 *                 type: string
 *                 example: "Hello world"
 *               targetLangs:
 *                 type: array
 *                 items:
 *                   type: string
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Translation successful
 */
router.post("/api/translate-beta-rag", betaRagTranslateController);

export default router;
