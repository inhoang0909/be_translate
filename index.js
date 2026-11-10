
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";
import sequelize from "./config/db.js";
import requestLoggerMiddleware from "./middleware/requestLoggerMiddleware.js";
import routes from "./routes/index.js";
import "./models/VocabularyCategory.js";
import "./models/RequestLog.js";
import "./models/SemanticCache.js";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(requestLoggerMiddleware);
app.set('trust proxy', true);

app.use("/", routes)

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = process.env.PORT || 5600;
const HOST = process.env.HOST;

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected");

    await sequelize.sync({ alter: true });
    console.log("Models synced (tables created/updated)");

    const callback = () => {
      const displayHost = HOST || "localhost";
      console.log(`Server running at http://${displayHost}:${PORT}`);
      console.log(`Swagger docs at http://${displayHost}:${PORT}/api-docs`);
    };

    if (HOST) {
      app.listen(PORT, HOST, callback);
    } else {
      app.listen(PORT, callback);
    }
  } catch (err) {
    console.error(" Database connection failed:", err);
    process.exit(1);
  }
})();
