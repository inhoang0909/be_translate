import { Op } from "sequelize";
import VocabularyTranslation from "../../models/VocabularyTranslation.js";
import Vocabulary from "../../models/Vocabulary.js";
import Category from "../../models/Category.js";
import sequelize from "../../config/db.js";
import { normalizeForSearch } from "../../utils/textNormalization.js";

export async function searchTranslations(keyword, options = {}) {
  const {
    languages = null,
    categories = null,
    limit = 10,
    useTrgm = true
  } = options;

  if (!keyword || typeof keyword !== 'string') {
    return [];
  }

  const normalizedKeyword = normalizeForSearch(keyword);
  if (!normalizedKeyword) {
    return [];
  }

  // Escape single quotes to prevent SQL injection in literal strings
  const safeKeyword = normalizedKeyword.replace(/'/g, "''");

  // [BƯỚC 2] - THÊM DÒNG NÀY: Kiểm tra xem keyword có chứa ký tự tiếng Trung không
  const isChinese = /[\u4e00-\u9fa5]/.test(normalizedKeyword);

  try {
    // Base attributes - always include these
    const attributes = ["id", "vocabularyId", "language", "text", "description", "textSearch"];

    let query = {
      // CHỈ dùng word_similarity lấy điểm nếu đang bật Trgm VÀ KHÔNG phải tiếng Trung
      attributes: (useTrgm && !isChinese) 
        ? {
            include: [
              [
                sequelize.fn('word_similarity', sequelize.col('textSearch'), safeKeyword),
                'similarityScore'
              ]
            ]
          }
        : attributes,
      include: [
        {
          model: Vocabulary,
          attributes: ["id"],
          include: [
            {
              model: Category,
              as: "Categories",
              attributes: ["id", "name"],
              through: { attributes: [] }
            }
          ]
        }
      ],
      limit,
      subQuery: false
    };

    // Build WHERE conditions
    const whereConditions = [];

    // [BƯỚC 2] - TÁCH LUỒNG TÌM KIẾM
    if (useTrgm && !isChinese) {
      // Logic 1: Dùng pg_trgm word_similarity cho Tiếng Việt / Tiếng Anh
      whereConditions.push(
        sequelize.where(
          sequelize.fn('word_similarity', sequelize.col('textSearch'), safeKeyword),
          { [Op.gte]: 0.3 }
        )
      );
    } else if (isChinese) {
      // Logic 2 (MỚI): Dành riêng cho tiếng Trung. Dùng LIKE để tìm chuỗi có chứa từ khóa
      whereConditions.push({
        textSearch: {
          [Op.like]: `%${safeKeyword}%`
        }
      });
    } else {
      // Logic 3: Fallback nếu không dùng trgm và không phải tiếng Trung
      whereConditions.push(
        sequelize.where(
          sequelize.literal(`'${safeKeyword}'`),
          { [Op.iLike]: sequelize.literal(`'%' || "VocabularyTranslation"."textSearch" || '%'`) }
        )
      );
    }

    // Language filter
    if (languages && Array.isArray(languages) && languages.length > 0) {
      whereConditions.push({
        language: {
          [Op.in]: languages
        }
      });
    }

    // Combine all WHERE conditions
    if (whereConditions.length > 0) {
      query.where = {
        [Op.and]: whereConditions
      };
    }

    // Category filter (applied to included Vocabulary)
    if (categories && Array.isArray(categories) && categories.length > 0) {
      query.include[0].include[0].where = {
        name: {
          [Op.in]: categories
        }
      };
      query.include[0].required = true; // INNER JOIN for category filter
    }

    // [BƯỚC 2] - ĐIỀU CHỈNH LUỒNG SẮP XẾP
    if (useTrgm && !isChinese) {
      // Sắp xếp theo điểm tương đồng nếu dùng trgm
      query.order = [
        [sequelize.fn('word_similarity', sequelize.col('textSearch'), safeKeyword), 'DESC'],
        ['id', 'ASC'] // Tiebreaker
      ];
    } else {
      // Nếu là tiếng Trung (hoặc fallback), sắp xếp theo ID mặc định
      query.order = [['id', 'ASC']];
    }

    const results = await VocabularyTranslation.findAll(query);
    return results;

  } catch (error) {
    throw error;
  }
}