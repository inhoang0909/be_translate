import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateUserRole,
} from "../controllers/userController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users list fetched successfully
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
 *                   example: "Users fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       empno:
 *                         type: string
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 *                       active:
 *                         type: boolean
 *                       categories:
 *                         type: array
 *                         items:
 *                           type: string
 *                       role:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/users", authenticate, getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User fetched successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.get("/users/:id", authenticate, getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john.doe.updated"
 *               email:
 *                 type: string
 *                 example: "john.updated@example.com"
 *               active:
 *                 type: boolean
 *                 example: true
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["HR", "Production"]
 *               role:
 *                 type: string
 *                 example: "admin"
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Bad request or invalid categories
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.put("/users/:id", authenticate, updateUser);

/**
 * @swagger
 * /api/users/{id}/role:
 *   patch:
 *     summary: Update user role
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 example: "admin"
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       400:
 *         description: Bad request (role must be a non-empty string)
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.patch("/users/:id/role", authenticate, updateUserRole);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags:
 *       - User Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/users/:id", authenticate, deleteUser);

export default router;
