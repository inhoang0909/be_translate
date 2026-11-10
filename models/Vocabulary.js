import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Vocabulary = sequelize.define("Vocabulary", {
}, { timestamps: true });

export default Vocabulary;
