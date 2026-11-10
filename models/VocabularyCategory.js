import sequelize from "../config/db.js";
import Vocabulary from "./Vocabulary.js";
import Category from "./Category.js";

const VocabularyCategory = sequelize.define("VocabularyCategory", {}, { timestamps: false });

Vocabulary.belongsToMany(Category, { through: VocabularyCategory, foreignKey: "vocabularyId" });
Category.belongsToMany(Vocabulary, { through: VocabularyCategory, foreignKey: "categoryId" });

export default VocabularyCategory;
