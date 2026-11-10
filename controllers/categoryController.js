import Category from "../models/Category.js";

export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const existing = await Category.findOne({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const category = await Category.create({ name });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getCategoryList = async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [["createdAt", "DESC"]] });
    return res.json({
      success: true,
      message: "Category list fetched successfully",
      categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required", data: null });
    }

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found", data: null });
    }

    category.name = name;
    await category.save();

    return res.json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({ success: false, message: "Internal server error", data: null });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found", data: null });
    }

    await category.destroy();

    return res.json({
      success: true,
      message: "Category deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({ success: false, message: "Internal server error", data: null });
  }
};