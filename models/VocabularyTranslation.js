import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import Vocabulary from "./Vocabulary.js";
import Category from "./Category.js";
import "./VocabularyCategory.js";
import { normalizeForSearch } from "../utils/textNormalization.js";

const VocabularyTranslation = sequelize.define("VocabularyTranslation", {
  language: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  text: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  embeddings: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  textSearch: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, { timestamps: true });

Vocabulary.hasMany(VocabularyTranslation, { foreignKey: "vocabularyId", onDelete: "CASCADE" });
VocabularyTranslation.belongsTo(Vocabulary, { foreignKey: "vocabularyId" });
import { embed as embedText } from "../services/CAG/embedding.js"; // Import hàm gọi Ollama của bạn

// ========================================================================
// TEXT SEARCH INDEX HOOK: TỰ ĐỘNG CẬP NHẬT TEXTSEARCH FIELD
// ========================================================================
// Populates textSearch field with normalized (diacritic-stripped) version of text
// This enables fuzzy search with pg_trgm (requires: CREATE EXTENSION pg_trgm;)
VocabularyTranslation.addHook("beforeSave", (translation, options) => {
  if (translation.text) {
    translation.textSearch = normalizeForSearch(translation.text);
    console.log(`[TextSearch] Updated textSearch for: "${translation.text}" -> "${translation.textSearch}"`);
  }
});

const API_KEY = process.env.QDRANT_API_KEY || 'Vgtranslation_csvn_2026_0904';
const COLLECTION_NAME = "vocabulary_collection";

let qdrant;

async function ensureReadableStream() {
  if (typeof globalThis.ReadableStream !== 'undefined') return;
  try {
    const mod = await import('stream/web');
    if (mod?.ReadableStream) {
      globalThis.ReadableStream = mod.ReadableStream;
      return;
    }
  } catch (error) {
    // Fall through to optional polyfill.
  }

  try {
    const polyfill = await import('web-streams-polyfill/ponyfill');
    if (polyfill?.ReadableStream) {
      globalThis.ReadableStream = polyfill.ReadableStream;
    }
  } catch (error) {
    console.warn('ReadableStream is not available and no polyfill is installed:', error.message || error);
  }
}

async function getQdrantClient() {
  if (qdrant) return qdrant;
  await ensureReadableStream();
  const { QdrantClient } = await import("@qdrant/js-client-rest");
  const url = process.env.QDRANT_URL || 'http://gmo021.cansportsvg.com:6333';
  qdrant = new QdrantClient({ url, apiKey: API_KEY });
  return qdrant;
}

async function getCategoryNames(translation) {
  if (translation?.Vocabulary?.Categories?.length) {
    return translation.Vocabulary.Categories.map((category) => category.name);
  }

  if (!translation?.vocabularyId) return [];

  const vocabulary = await translation.getVocabulary({
    include: [{
      model: Category,
      attributes: ["name"],
      through: { attributes: [] }
    }]
  });

  return vocabulary?.Categories?.map((category) => category.name) ?? [];
}

// ========================================================================
// SEQUELIZE HOOKS: TỰ ĐỘNG ĐỒNG BỘ POSTGRES -> QDRANT
// ========================================================================

// 1. KHI ADMIN THÊM MỚI HOẶC SỬA TỪ VỰNG
VocabularyTranslation.addHook("afterSave", async (translation, options) => {
  try {
    // Chỉ đồng bộ khi nội dung chữ bị thay đổi (để đỡ tốn công gọi API Ollama vô ích)
    if (translation.changed("text") || translation.isNewRecord) {
      console.log(`[Qdrant Sync] Đang tạo vector 768 chiều cho: "${translation.text}"...`);

      // 1. Gọi Ollama sinh vector mới
      const vector = await embedText(translation.text);
      const categoryNames = await getCategoryNames(translation);

      // (Tùy chọn): Nếu bạn muốn lưu cả cục vector này ngược lại vào Postgres để backup
      // translation.embeddings = vector;
      // await translation.save({ hooks: false }); // hooks: false để tránh vòng lặp vô hạn

      // 2. Bắn sang Qdrant
      const client = await getQdrantClient();
      await client.upsert(COLLECTION_NAME, {
        wait: true, // Đợi Qdrant báo thành công mới đi tiếp
        points: [
          {
            id: translation.id,
            vector: vector,
            payload: {
              vocabularyId: translation.vocabularyId,
              text: translation.text,
              language: translation.language,
              categories: categoryNames
            }
          }
        ]
      });
      console.log(`✅ [Qdrant Sync] Đã cập nhật ID ${translation.id} thành công.`);
    }
  } catch (error) {
    console.error(`❌ [Qdrant Error] Lỗi đồng bộ ID ${translation.id}:`, error.message);
  }
});

// 2. KHI ADMIN XÓA TỪ VỰNG
VocabularyTranslation.addHook("afterDestroy", async (translation, options) => {
  try {
    console.log(`[Qdrant Sync] Đang xóa ID ${translation.id} khỏi Vector DB...`);

    const client = await getQdrantClient();
    await client.delete(COLLECTION_NAME, {
      points: [translation.id]
    });

    console.log(`🗑️ [Qdrant Sync] Đã xóa ID ${translation.id} thành công.`);
  } catch (error) {
    console.error(`❌ [Qdrant Error] Lỗi xóa ID ${translation.id}:`, error.message);
  }
});
export default VocabularyTranslation;
