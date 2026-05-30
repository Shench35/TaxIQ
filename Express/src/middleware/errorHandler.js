// Centralized error handler that logs failures and returns safe API responses.
import { logError } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  const statusCode = err.status || 500;

  logError(err, req);

  res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 ? "Internal server error" : err.message || "An error occurred",
  });
}