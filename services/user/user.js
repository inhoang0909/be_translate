import User from "../../models/User.js";
import { Op } from "sequelize";

export const findByUsernameOrEmpno = (identifier) =>
  User.findOne({
    where: {
      [Op.or]: [{ empno: identifier }, { username: identifier }],
    },
  });

export const createUser = async ({
  empno,
  username,
  categories,
  role = "user",
  language = null,
}) => {
  const usernameValue = username || empno;
  return User.create({
    empno,
    username: usernameValue,
    active: true,
    categories,
    role,
    language,
  });
};

export const updateRoleById = async (userId, role) => {
  const user = await User.findByPk(userId);
  if (!user) return null;
  user.role = role;
  await user.save();
  return user;
};

export const syncGlobalInfo = async (user, globalUser) => {
  let needSave = false;

  if (globalUser.email && user.email !== globalUser.email) {
    user.email = globalUser.email;
    needSave = true;
  }

  if (globalUser.name && user.name !== globalUser.name) {
    user.name = globalUser.name;
    needSave = true;
  }

  if (globalUser.dept && user.dept !== globalUser.dept) {
    user.dept = globalUser.dept;
    needSave = true;
  }

  if (globalUser.role && user.role !== globalUser.role) {
    user.role = globalUser.role;
    needSave = true;
  }

  if (globalUser.language && user.language !== globalUser.language) {
    user.language = globalUser.language;
    needSave = true;
  }

  if (needSave) await user.save();
};
