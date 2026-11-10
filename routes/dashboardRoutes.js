import express from "express";
import { getDashboardStats, getDashboardSummary, listTranslations, getTranslationById } from "../controllers/dashboardController.js";

const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Admin Dashboard
 *     description: Các API dành riêng cho trang quản trị Admin
 */

/**
 * @swagger
 * /api/admin/dashboard-stats:
 *   get:
 *     summary: Lấy dữ liệu thống kê cho Dashboard
 *     description: Trả về tổng số API request, số lượng IP (User active) và dữ liệu biểu đồ. Hỗ trợ lọc theo ngày hoặc theo tháng.
 *     tags:
 *       - Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum:
 *             - day
 *             - month
 *           default: day
 *         description: "Tiêu chí nhóm dữ liệu cho biểu đồ. 'day': theo từng ngày, 'month': theo từng tháng."
 *       - in: query
 *         name: range
 *         schema:
 *           type: integer
 *         description: "Số lượng mốc thời gian lấy về nếu không sử dụng startDate/endDate. Ví dụ: groupBy='day' và range=7 -> Lấy 7 ngày."
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: "Ngày bắt đầu (YYYY-MM-DD). Nếu cung cấp startDate/endDate thì sẽ ưu tiên sử dụng khoảng này."
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: "Ngày kết thúc (YYYY-MM-DD)."
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thống kê thành công
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
 *                     totalRequests:
 *                       type: integer
 *                       example: 12450
 *                       description: Tổng số lượt gọi API dịch thuật
 *                     uniqueIps:
 *                       type: integer
 *                       example: 842
 *                       description: Số lượng IP riêng biệt (Active Users)
 *                     chartData:
 *                       type: array
 *                       description: Dữ liệu đã pivot sẵn để vẽ biểu đồ cột chồng
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             example: "10/04/2026"
 *                           en:
 *                             type: integer
 *                             example: 150
 *                           vi:
 *                             type: integer
 *                             example: 80
 *                           zh:
 *                             type: integer
 *                             example: 40
 *                     meta:
 *                       type: object
 *                       description: Thông tin siêu dữ liệu về khoảng thời gian đang lọc
 *                       properties:
 *                         groupBy:
 *                           type: string
 *                           example: "day"
 *                         range:
 *                           type: integer
 *                           example: 7
 *                         startDate:
 *                           type: string
 *                           example: "2026-04-08"
 *                         endDate:
 *                           type: string
 *                           example: "2026-04-14"
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Lỗi máy chủ nội bộ"
 */
router.get("/dashboard-stats", getDashboardStats);

/**
 * @swagger
 * /api/admin/dashboard-summary:
 *   get:
 *     summary: Lấy tóm tắt thống kê Dashboard
 *     description: Trả về tổng số request, trung bình rating feedback, và tổng số user
 *     tags:
 *       - Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy tóm tắt thành công
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
 *                     totalRequests:
 *                       type: integer
 *                       example: 50000
 *                       description: Tổng số lượt gọi API
 *                     averageFeedbackRating:
 *                       type: number
 *                       example: 4.5
 *                       description: Trung bình rating của feedback (từ 1-5)
 *                     totalFeedbacks:
 *                       type: integer
 *                       example: 1200
 *                       description: Tổng số lượng feedback nhận được
 *                     totalUsers:
 *                       type: integer
 *                       example: 500
 *                       description: Tổng số user trong hệ thống
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Lỗi máy chủ nội bộ"
 */
router.get("/dashboard-summary", getDashboardSummary);
/**
 * @swagger
 * /api/admin/dashboard-translations:
 *   get:
 *     summary: Lấy danh sách bản dịch
 *     description: Trả về danh sách translations với thông tin chính và feedback nếu có.
 *     tags:
 *       - Admin Dashboard
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số lượng bản ghi trả về mỗi trang
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang cần lấy (bắt đầu từ 1)
 *     responses:
 *       200:
 *         description: Danh sách translations thành công
 */
router.get("/dashboard-translations", listTranslations);

/**
 * @swagger
 * /api/admin/dashboard-translations/{id}:
 *   get:
 *     summary: Lấy chi tiết translation theo id
 *     tags:
 *       - Admin Dashboard
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Translation id
 *     responses:
 *       200:
 *         description: Chi tiết translation kèm feedback
 *       404:
 *         description: Không tìm thấy translation
 */
router.get("/dashboard-translations/:id", getTranslationById);

export default router;