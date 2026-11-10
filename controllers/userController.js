import User from "../models/User.js";
import { Op } from "sequelize";
import { updateRoleById } from "../services/user/user.js";
import { validateCategories } from "../services/auth/category.js";

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        "id",
        "empno",
        "username",
        "email",
        "active",
        "categories",
        "role",
        "createdAt",
        "updatedAt",
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json({
      success: true,
      message: "Users fetched",
      data: users,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: [
        "id",
        "empno",
        "username",
        "email",
        "active",
        "categories",
        "role",
        "createdAt",
        "updatedAt",
      ],
    });
    if (!user)
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null,
      });
    return res.json({
      success: true,
      message: "User fetched",
      data: user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null,
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { username, email, active, categories, role } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user)
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null,
      });

    if (username && username !== user.username) {
      const exists = await User.findOne({
        where: { username, id: { [Op.ne]: user.id } },
      });
      if (exists)
        return res.status(400).json({
          success: false,
          message: "Username already exists",
          data: null,
        });
      user.username = username;
    }

    if (email !== undefined) user.email = email;
    if (active !== undefined) user.active = active;

    if (categories !== undefined) {
      if (!Array.isArray(categories) || categories.length === 0)
        return res.status(400).json({
          success: false,
          message: "categories must be a non-empty array",
          data: null,
        });
      try {
        const validated = await validateCategories(categories);
        user.categories = validated;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
          data: null,
        });
      }
    }

    if (role !== undefined) {
      if (typeof role !== "string" || role.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "role must be a non-empty string",
          data: null,
        });
      }
      user.role = role.trim();
    }

    await user.save();
    return res.json({
      success: true,
      message: "User updated",
      data: {
        id: user.id,
        empno: user.empno,
        username: user.username,
        email: user.email,
        active: user.active,
        categories: user.categories,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null,
    });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (typeof role !== "string" || role.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "role must be a non-empty string",
        data: null,
      });
    }

    const updated = await updateRoleById(req.params.id, role.trim());
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null,
      });
    }

    return res.json({
      success: true,
      message: "Role updated",
      data: {
        id: updated.id,
        role: updated.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null,
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user)
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null,
      });
    await user.destroy();
    return res.json({
      success: true,
      message: "User deleted",
      data: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null,
    });
  }
};
