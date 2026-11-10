import Category from "../../models/Category.js";
import { Op } from "sequelize";

export const validateCategories = async (categories) => {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error("categories array is required and must not be empty");
  }

  const found = await Category.findAll({
    where: {
      name: { [Op.in]: categories },
    },
  });

  const validNames = found.map((c) => c.name);
  const invalid = categories.filter((c) => !validNames.includes(c));
  if (invalid.length > 0) {
    throw new Error(`Invalid categories: ${invalid.join(", ")}`);
  }

  return [...new Set(categories)];
};
