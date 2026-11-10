import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Url = sequelize.define("Url", {
  endpoint: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  healthCheckPath: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "/version",
  },
}, {
  timestamps: true,
});

export default Url;