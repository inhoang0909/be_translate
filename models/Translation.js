import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

// Explicit model definition to ensure correct table name and columns
const Translation = sequelize.define(
  "Translation",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    original: { type: DataTypes.TEXT, allowNull: false },
    correctedInput: { type: DataTypes.TEXT, allowNull: true },
    detected: { type: DataTypes.STRING, allowNull: false },
    targetLang: { type: DataTypes.STRING, allowNull: false },
    translatedText: { type: DataTypes.TEXT, allowNull: false },
    source: { type: DataTypes.STRING, allowNull: true },
    model: { type: DataTypes.STRING, allowNull: false, defaultValue: "qwen3-8b" },

    // RAG / metadata fields
    categories: { type: DataTypes.STRING, allowNull: true },
    ragUsed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    matchedCategories: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "Translations", 
    freezeTableName: true,    
  }
);

export default Translation;