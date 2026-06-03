// Simple in-memory rate limiter for login attempts (per email+IP).
const attempts = new Map();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCK_MS = 15 * 60 * 1000; // 15 minutes lockout

function keyFor(req) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const email = req.body?.email || '';
  return `${email.toLowerCase()}|${ip}`;
}

export function loginRateLimiter(req, res, next) {
  const key = keyFor(req);
  const now = Date.now();
  const info = attempts.get(key) || { count: 0, firstAt: now, lockedUntil: 0 };

  if (info.lockedUntil && now < info.lockedUntil) {
    return res.status(429).json({ success: false, error: 'Too many login attempts. Try later.' });
  }

  if (now - info.firstAt > WINDOW_MS) {
    info.count = 0;
    info.firstAt = now;
    info.lockedUntil = 0;
  }

  req._rateLimitKey = key;
  req._rateLimitInfo = info;
  attempts.set(key, info);
  next();
}

export function recordFailedLogin(req) {
  const key = req._rateLimitKey;
  if (!key) return;
  const info = attempts.get(key) || { count: 0, firstAt: Date.now(), lockedUntil: 0 };
  info.count = (info.count || 0) + 1;
  if (info.count >= MAX_ATTEMPTS) info.lockedUntil = Date.now() + LOCK_MS;
  attempts.set(key, info);
}

export function recordSuccessfulLogin(req) {
  const key = req._rateLimitKey;
  if (!key) return;
  attempts.delete(key);
}
