import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const SemanticCache = sequelize.define("SemanticCache", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  key: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: "RESULT",
  },
  targetLang: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  value: {
    type: DataTypes.JSON, // Use JSON for flexible value storage
    allowNull: false,
  },
  embedding: {
    type: DataTypes.JSON, // PostGreSQL supports JSON/JSONB for array storage
    allowNull: true,
  },
  ttl: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  expireAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  indexes: [
    {
      fields: ['expireAt'],
    },
    // Add index on id if needed, but primary key is already indexed.
  ]
});

export default SemanticCache;
