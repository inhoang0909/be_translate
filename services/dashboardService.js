import { Op } from "sequelize";
import sequelize from "../config/db.js";
import RequestLog from "../models/RequestLog.js";
import TranslationFeedback from "../models/TranslationFeedback.js";
import User from "../models/User.js";
import Translation from "../models/Translation.js";

export const listTranslations = async ({ limit = 20, offset = 0, includeFeedback = false, targetLang, search } = {}) => {
  const where = {};
  if (targetLang) where.targetLang = targetLang;
  if (search) {
    where[Op.or] = [
      { original: { [Op.like]: `%${search}%` } },
      { translatedText: { [Op.like]: `%${search}%` } },
    ];
  }

  const include = [];
  if (includeFeedback) {
    include.push({
      model: TranslationFeedback,
      attributes: ["id", "rating", "comment", "userCorrection", "createdAt", "updatedAt"],
    });
  }

  const result = await Translation.findAndCountAll({
    where,
    attributes: [
      "id",
      "original",
      "correctedInput",
      "detected",
      "targetLang",
      "translatedText",
      "source",
      "model",
      "categories",
      "ragUsed",
      "matchedCategories",
      "createdAt",
    ],
    include,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  return { total: result.count, items: result.rows };
};

export const getTranslationById = async (id) => {
  return Translation.findByPk(id, {
    include: [
      {
        model: TranslationFeedback,
        attributes: ["id", "rating", "comment", "userCorrection", "createdAt", "updatedAt"],
      },
    ],
  });
};

export const getDashboardStats = async ({ groupBy = "day", startDate, endDate, range } = {}) => {
  // Prepare date range (YYYY-MM-DD)
  let endStr = endDate;
  let startStr = startDate;
  const today = new Date();

  if (!endStr) {
    endStr = today.toISOString().split("T")[0];
  }

  if (!startStr) {
    if (groupBy === "month") {
      const r = range && Number.isFinite(Number(range)) ? parseInt(range, 10) : 6;
      const startDateObj = new Date();
      startDateObj.setMonth(today.getMonth() - r + 1);
      startDateObj.setDate(1);
      startStr = startDateObj.toISOString().split("T")[0];
    } else {
      const r = range && Number.isFinite(Number(range)) ? parseInt(range, 10) : 14;
      const startDateObj = new Date();
      startDateObj.setDate(today.getDate() - r + 1);
      startStr = startDateObj.toISOString().split("T")[0];
    }
  }

  // Total requests
  const totalRequests = await RequestLog.count({
    where: { date: { [Op.between]: [startStr, endStr] } },
  });

  // Unique IPs
  const uniqueIps = await RequestLog.count({
    where: { date: { [Op.between]: [startStr, endStr] } },
    distinct: true,
    col: "ip",
  });

  // Raw data grouped by date + endpoint
  const rawChartData = await RequestLog.findAll({
    attributes: ["date", "endpoint", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    where: { date: { [Op.between]: [startStr, endStr] } },
    group: ["date", "endpoint"],
    order: [["date", "ASC"]],
    raw: true,
  });

  // Pivot / aggregate into chartData
  const chartMap = {};
  rawChartData.forEach((row) => {
    const [year, month, day] = row.date.split("-");
    const displayLabel = groupBy === "month" ? `${month}/${year}` : `${day}/${month}/${year}`;

    if (!chartMap[displayLabel]) {
      chartMap[displayLabel] = { date: displayLabel };
    }

    const key = row.endpoint ? row.endpoint.split("/").pop() : "unknown";
    if (!chartMap[displayLabel][key]) chartMap[displayLabel][key] = 0;
    chartMap[displayLabel][key] += parseInt(row.count, 10);
  });

  const chartData = Object.values(chartMap);

  return {
    totalRequests,
    uniqueIps,
    chartData,
    meta: {
      groupBy,
      startDate: startStr,
      endDate: endStr,
      range: range || (groupBy === "month" ? 6 : 14),
    },
  };
};

export const getDashboardSummary = async () => {
  const totalRequests = await RequestLog.count();

  const feedbackData = await TranslationFeedback.findOne({
    attributes: [
      [sequelize.fn("AVG", sequelize.col("rating")), "avgRating"],
      [sequelize.fn("COUNT", sequelize.col("id")), "totalFeedback"],
    ],
    raw: true,
  });

  const averageFeedbackRating = feedbackData?.avgRating ? parseFloat(feedbackData.avgRating) : 0;
  const totalUsers = await User.count();

  return {
    totalRequests,
    averageFeedbackRating: parseFloat(Number(averageFeedbackRating).toFixed(2)),
    totalFeedbacks: parseInt(feedbackData?.totalFeedback || 0, 10),
    totalUsers,
  };
};

