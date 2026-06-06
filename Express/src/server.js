// Server entrypoint: configures Express, middleware, and mounts routes.
// Starts the HTTP listener using environment `PORT`.
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes.js";
import creditRoutes from "./routes/credit.routes.js";
import keysRoutes from "./routes/keys.routes.js";
import orgRoutes from "./routes/org.routes.js";
import verificationsRoutes from "./routes/verifications.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get("/health", (req, res) => {
  res.json({ success: true, message: "Express API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/credit", creditRoutes);
app.use("/api/keys", keysRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/verifications", verificationsRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Express API running on port ${port}`);
});