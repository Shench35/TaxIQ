// Auth route definitions for registration and login.
import { Router } from "express";
import { login, register } from "../controllers/auth.controller.js";
import { loginRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post("/register", register);

router.post("/login", loginRateLimiter, login);

export default router;