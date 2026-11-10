import express from "express";
import {
  createFeedbackController,
  getFeedbackController,
  getFeedbackStatsController,
  approveFeedbackController,
} from "../controllers/feedbackController.js";
import {
  getCacheController,
  deleteCacheController,
  updateCacheController,
} from "../controllers/cacheController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Feedback
 *     description: Translation feedback API linked to specific requests
 *   - name: Admin Cache
 *     description: Admin APIs for managing translation cache overrides and deletions
 */

/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Submit translation feedback
 *     tags: [Feedback]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - translationId
 *               - rating
 *             properties:
 *               translationId:
 *                 type: integer
 *               rating:
 *                 type: integer
 *               userCorrection:
 *                 type: string
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Feedback submitted successfully
 */
router.post("/api/feedback", createFeedbackController);

/**
 * @swagger
 * /api/feedback:
 *   get:
 *     summary: Get all translation feedbacks with pagination & filters
 *     tags: [Feedback]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           enum: [1,2,3,4,5]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns list of feedbacks with translation details & cache keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                       example: 45
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get("/api/feedback", getFeedbackController);

/**
 * @swagger
 * /api/feedback/stats:
 *   get:
 *     summary: Get feedback statistics
 *     tags: [Feedback]
 *     responses:
 *       200:
 *         description: Returns feedback stats
 */
router.get("/api/feedback/stats", getFeedbackStatsController);

/**
 * @swagger
 * /api/feedback/{id}/approve:
 *   post:
 *     summary: Admin Approve feedback & promote correction to SemanticCache (TTL 90 days)
 *     tags: [Admin Cache]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Feedback ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               targetLang: "vi"
 *               overrideCorrection: "Áp dụng lạng máy lớn"
 *             properties:
 *               targetLang:
 *                 type: string
 *                 description: Ngôn ngữ đích muốn cập nhật (ví dụ vi, zh-tw, en). Nếu không truyền sẽ cập nhật theo ngôn ngữ của feedback.
 *               overrideCorrection:
 *                 type: string
 *                 description: Bản dịch mới cần đè vào cache
 *     responses:
 *       200:
 *         description: Approved and promoted successfully
 */
router.post("/api/feedback/:id/approve", approveFeedbackController);

/**
 * @swagger
 * /api/cache:
 *   get:
 *     summary: Admin Get list of cached items in SemanticCache with pagination & search
 *     tags: [Admin Cache]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: targetLang
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [RESULT, PROMPT]
 *           description: Filter cache by type (RESULT or PROMPT)
 *     responses:
 *       200:
 *         description: Returns list of cached translations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                       example: 100
 *                     totalPages:
 *                       type: integer
 *                       example: 10
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get("/api/cache", getCacheController);

/**
 * @swagger
 * /api/cache:
 *   delete:
 *     summary: Admin Delete bad translation cache from SemanticCache
 *     tags: [Admin Cache]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *                 description: Cache key or partial key to delete
 *               id:
 *                 type: integer
 *                 description: Cache record ID
 *     responses:
 *       200:
 *         description: Cache deleted successfully
 */
router.delete("/api/cache", deleteCacheController);

/**
 * @swagger
 * /api/cache:
 *   put:
 *     summary: Admin Direct edit/update translation entry in SemanticCache (TTL 90 days)
 *     tags: [Admin Cache]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               id: 8646
 *               translationText: "limitation of decentralization"
 *             properties:
 *               id:
 *                 type: integer
 *                 description: ID của bản ghi (khuyên dùng)
 *               key:
 *                 type: string
 *                 description: Cache key (nếu không dùng id)
 *               translationText:
 *                 type: string
 *                 description: Nội dung bản dịch mới
 *               targetLang:
 *                 type: string
 *                 description: Ngôn ngữ đích (mặc định vi)
 *               translations:
 *                 type: object
 *                 description: Hoặc truyền object bản dịch theo ngôn ngữ (ví dụ en -> translationText)
 *     responses:
 *       200:
 *         description: Cache updated successfully
 *       400:
 *         description: Missing required field ('id' or 'key', 'translationText' or 'translations')
 *       404:
 *         description: Cache record not found
 */
router.put("/api/cache", updateCacheController);

export default router;
