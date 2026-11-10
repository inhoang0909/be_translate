import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import Translation from "./Translation.js";

const TranslationFeedback = sequelize.define(
  "TranslationFeedback",
  {
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true 
    },
    translationId: {
      type: DataTypes.BIGINT,
      allowNull: false, // Bắt buộc phải có để biết thuộc về bản dịch nào
      references: {
        model: 'Translations', // Tên bảng Translation trong database
        key: 'id'
      }
    },
    userCorrection: { 
      type: DataTypes.TEXT, 
      allowNull: true 
    },
    rating: { 
      type: DataTypes.INTEGER, 
      allowNull: false 
    },
    comment: {
      type: DataTypes.TEXT, 
      allowNull: true
    }
  },
  {
    timestamps: true,
    tableName: "TranslationFeedbacks",
  }
);

// Thiết lập quan hệ với `Translation`
TranslationFeedback.belongsTo(Translation, { foreignKey: 'translationId', as: 'translation' });
Translation.hasOne(TranslationFeedback, { foreignKey: 'translationId' });

export default TranslationFeedback;