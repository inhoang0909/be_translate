import express from "express";
import categoryRoutes from "./categoryRoutes.js";
import vocabularyRoutes from "./vocabularyRoutes.js";
import translateRoutes from "./translateRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import apiRoute from "./apiRoute.js";
import authRoutes from "./authRoutes.js";
import userRoute from "./userRoute.js";
import feedbackRoutes from "./feedbackRoutes.js";
const router = express.Router();

router.use("/api", categoryRoutes);
router.use("/api", vocabularyRoutes);
router.use("/", translateRoutes);
router.use("/", feedbackRoutes);
router.use("/api", apiRoute);
router.use("/api/admin", dashboardRoutes);
router.use("/api/auth", authRoutes);
router.use("/api", userRoute);

export default router;
