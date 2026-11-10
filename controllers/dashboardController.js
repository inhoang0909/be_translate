import { getDashboardStats as getDashboardStatsService, getDashboardSummary as getDashboardSummaryService } from "../services/dashboardService.js";
import { listTranslations as listTranslationsService, getTranslationById as getTranslationByIdService } from "../services/dashboardService.js";
export const getDashboardStats = async (req, res) => {
  try {
    const groupBy = req.query.groupBy || "day";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const range = req.query.range ? parseInt(req.query.range, 10) : undefined;

    const data = await getDashboardStatsService({ groupBy, startDate, endDate, range });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Lỗi khi lấy Dashboard Stats:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};

export const getDashboardSummary = async (req, res) => {
  try {
    const data = await getDashboardSummaryService();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Lỗi khi lấy Dashboard Summary:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};

// List translations (with optional feedback)
export async function listTranslations(req, res) {
 try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;

    const data = await listTranslationsService({ limit, offset: (page - 1) * limit });

    return res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bản dịch:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
}

// Get translation detail by id (including feedback)
export async function getTranslationById(req, res) {
  try {
    const id = req.params.id;
    const translation = await getTranslationByIdService(id);
    if (!translation) return res.status(404).json({ success: false, message: "Translation not found" });
    return res.status(200).json({ success: true, data: translation });
  } catch (error) {
    console.error("Lỗi khi lấy translation detail:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
}