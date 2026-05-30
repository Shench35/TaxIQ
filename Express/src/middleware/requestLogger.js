// Request logger middleware that records request and response details.
import { logInfo, logRequest } from "../utils/logger.js";

export function requestLogger(req, res, next) {
  const startTime = Date.now();

  logInfo("HTTP request received", {
    method: req.method,
    path: req.originalUrl,
    userAgent: req.get("user-agent") || null,
  });

  res.on("finish", () => {
    logRequest(req, res, Date.now() - startTime);
  });

  next();
}