// Lightweight structured logger for development and production diagnostics.
function formatMeta(meta) {
  return meta ? ` ${JSON.stringify(meta)}` : "";
}

function emit(level, message, meta) {
  const timestamp = new Date().toISOString();
  const suffix = formatMeta(meta);
  console[level](`${timestamp} [${level.toUpperCase()}] ${message}${suffix}`);
}

export function logInfo(message, meta) {
  emit("log", message, meta);
}

export function logRequest(req, res, durationMs) {
  logInfo("HTTP request completed", {
    method: req.method,
    path: req.originalUrl,
    statusCode: res.statusCode,
    durationMs,
    userAgent: req.get("user-agent") || null,
  });
}

export function logError(err, req) {
  const meta = {
    method: req?.method || null,
    path: req?.originalUrl || null,
    statusCode: err?.status || 500,
    stack: err?.stack || null,
  };

  emit("error", err?.message || "Unhandled error", meta);
}