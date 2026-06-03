// Auth controller for organization registration and login.
// Registration accepts organization fields and returns a JWT + public org object.
import { loginOrg, registerOrg } from "../services/auth.service.js";
import { recordFailedLogin, recordSuccessfulLogin } from "../middleware/rateLimiter.js";

function getRegisterPayload(body) {
  return {
    orgName: body.orgName,
    orgAddress: body.orgAddress,
    email: body.email,
    phoneNumber: body.phoneNumber,
    password: body.password,
  };
}

export async function register(req, res, next) {
  try {
    const payload = getRegisterPayload(req.body);

    if (!payload.email || !payload.password || !payload.orgName || !payload.orgAddress) {
      return res.status(400).json({
        success: false,
        error: "orgName, orgAddress, email and password are required",
      });
    }

    const result = await registerOrg(payload);

    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "email and password are required" });
    }

    const result = await loginOrg({ email, password });
    // successful - clear rate limit for this key
    try { recordSuccessfulLogin(req); } catch (e) { /* ignore */ }
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    try { recordFailedLogin(req); } catch (e) { /* ignore */ }
    return next(error);
  }
}