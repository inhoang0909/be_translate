import express from "express";
import {
  getUrlList,
  createUrl,
  updateUrl,
  deleteUrl
} from "../controllers/urlController.js";

const router = express.Router();

/**
 * @swagger
 * /api/getUrlList:
 *   get:
 *     summary: Get all API endpoints
 *     tags:
 *       - API Management
 *     responses:
 *       200:
 *         description: A list of API endpoints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       500:
 *         description: Internal server error
 */
router.get("/getUrlList", getUrlList);

/**
 * @swagger
 * /api/createUrl:
 *   post:
 *     summary: Create new API endpoint
 *     tags:
 *       - API Management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *             properties:
 *               endpoint:
 *                 type: string
 *                 example: "https://example.com/api"
 *               active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Endpoint created
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.post("/createUrl", createUrl);

/**
 * @swagger
 * /api/updateUrl/{id}:
 *   put:
 *     summary: Update API endpoint
 *     tags:
 *       - API Management
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The API endpoint ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endpoint:
 *                 type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Endpoint updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Endpoint not found
 *       500:
 *         description: Internal server error
 */
router.put("/updateUrl/:id", updateUrl);

/**
 * @swagger
 * /api/deleteUrl/{id}:
 *   delete:
 *     summary: Delete API endpoint
 *     tags:
 *       - API Management
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The API endpoint ID
 *     responses:
 *       200:
 *         description: Endpoint deleted successfully
 *       404:
 *         description: Endpoint not found
 *       500:
 *         description: Internal server error
 */
router.delete("/deleteUrl/:id", deleteUrl);

export default router;