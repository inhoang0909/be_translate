import Url from "../models/Url.js";
import { reloadEndpointsFromDB } from "../services/apiManager.js";

// data function usable outside Express handlers
export async function fetchUrlList() {
  const urls = await Url.findAll({ order: [["createdAt", "DESC"]] });
  return urls;
}

export const createUrl = async (req, res) => {
  try {
    const { endpoint, active } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: "Endpoint is required" });
    }

    const existing = await Url.findOne({ where: { endpoint } });
    if (existing) {
      return res.status(400).json({ error: "Endpoint already exists" });
    }

    const url = await Url.create({
      endpoint,
      active: active !== undefined ? active : true,
    });

    // reload in-memory endpoints (do not block if reload fails)
    reloadEndpointsFromDB().catch(err => console.warn("[urlController] reloadEndpointsFromDB failed:", err?.message || err));

    return res.status(201).json({
      success: true,
      message: "URL created successfully",
      data: url,
    });
  } catch (error) {
    console.error("Error creating URL:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getUrlList = async (req, res) => {
  try {
    const urls = await fetchUrlList(); // reuse data function
    return res.json({
      success: true,
      message: "URL list fetched successfully",
      urls,
    });
  } catch (error) {
    console.error("Error fetching URLs:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { endpoint, active, healthCheckPath } = req.body;

    if (endpoint === undefined && active === undefined && healthCheckPath === undefined) {
      return res.status(400).json({
        success: false,
        message: "No fields to update. Provide 'endpoint', 'active' or 'healthCheckPath'.",
        data: null
      });
    }

    const url = await Url.findByPk(id);
    if (!url) {
      return res.status(404).json({ success: false, message: "URL not found", data: null });
    }

    if (endpoint !== undefined && endpoint !== url.endpoint) {
      const existing = await Url.findOne({ where: { endpoint } });
      if (existing && existing.id !== url.id) {
        return res.status(400).json({ success: false, message: "Endpoint already exists", data: null });
      }
      url.endpoint = endpoint;
    }

    if (active !== undefined) {
      url.active = active;
    }

    if (healthCheckPath !== undefined) {
      url.healthCheckPath = healthCheckPath;
    }

    await url.save();

    // reload endpoints after update
    reloadEndpointsFromDB().catch(err => console.warn("[urlController] reloadEndpointsFromDB failed:", err?.message || err));

    return res.json({
      success: true,
      message: "URL updated successfully",
      data: url,
    });
  } catch (error) {
    console.error("Error updating URL:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteUrl = async (req, res) => {
  try {
    const { id } = req.params;

    const url = await Url.findByPk(id);
    if (!url) {
      return res.status(404).json({ success: false, message: "URL not found", data: null });
    }

    await url.destroy();

    // reload endpoints after delete
    reloadEndpointsFromDB().catch(err => console.warn("[urlController] reloadEndpointsFromDB failed:", err?.message || err));

    return res.json({
      success: true,
      message: "URL deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting URL:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};