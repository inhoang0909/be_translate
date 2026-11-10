import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const RequestLog = sequelize.define(
  "RequestLog",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    service: { type: DataTypes.STRING },
    endpoint: { type: DataTypes.STRING },
    method: { type: DataTypes.STRING },
    status: { type: DataTypes.INTEGER },
    ip: { type: DataTypes.STRING },
    date: { type: DataTypes.DATEONLY },
    time: { type: DataTypes.DATE },
    meta: { type: DataTypes.JSON },
  },
  {
    timestamps: false,
    tableName: "request_logs",
  }
);

export default RequestLog;
