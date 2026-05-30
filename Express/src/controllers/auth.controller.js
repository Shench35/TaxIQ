// Auth controller for validating auth input and returning API responses.
import { loginUser, registerUser } from "../services/auth.service.js";

function getRegisterPayload(body) {
  return {
    email: body.email,
    password: body.password,
    fullName: body.fullName,
    businessName: body.businessName,
    phoneNumber: body.phoneNumber,
  };
}

export async function register(req, res, next) {
  try {
    const payload = getRegisterPayload(req.body);

    if (!payload.email || !payload.password || !payload.fullName) {
      return res.status(400).json({
        success: false,
        error: "email, password, and fullName are required",
      });
    }

    const result = await registerUser(payload);

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "email and password are required",
      });
    }

    const result = await loginUser({ email, password });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}