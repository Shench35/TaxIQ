// Auth service for user persistence, password hashing, and JWT issuance.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usersPath = path.join(__dirname, "../data/users.json");
const dummyPasswordHash = bcrypt.hashSync("dummy-password", 12);

async function readUsers() {
  const fileContents = await readFile(usersPath, "utf8");
  const parsed = JSON.parse(fileContents);
  return Array.isArray(parsed.users) ? parsed.users : [];
}

async function writeUsers(users) {
  await writeFile(usersPath, `${JSON.stringify({ users }, null, 2)}\n`, "utf8");
}

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw Object.assign(new Error("JWT_SECRET is not configured"), { status: 500 });
  }

  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    businessName: user.businessName || null,
    phoneNumber: user.phoneNumber || null,
  };
}

function ensureMinimumPasswordStrength(password) {
  if (String(password || "").length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters"), { status: 400 });
  }
}

export async function registerUser({ email, password, fullName, businessName, phoneNumber }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw Object.assign(new Error("Email is required"), { status: 400 });
  }

  ensureMinimumPasswordStrength(password);

  if (!fullName || !String(fullName).trim()) {
    throw Object.assign(new Error("fullName is required"), { status: 400 });
  }

  const users = await readUsers();
  const existingUser = users.find((user) => user.email === normalizedEmail);

  if (existingUser) {
    throw Object.assign(new Error("Email already registered"), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = {
    id: uuidv4(),
    email: normalizedEmail,
    passwordHash,
    fullName: String(fullName).trim(),
    businessName: businessName ? String(businessName).trim() : null,
    phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
    monoAccountId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeUsers(users);

  return {
    token: signToken(newUser),
    user: toPublicUser(newUser),
  };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw Object.assign(new Error("Email is required"), { status: 400 });
  }

  const users = await readUsers();
  const user = users.find((entry) => entry.email === normalizedEmail);

  const passwordHash = user?.passwordHash || dummyPasswordHash;
  const isValidPassword = await bcrypt.compare(password, passwordHash);

  if (!user || !isValidPassword) {
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }

  return {
    token: signToken(user),
    user: toPublicUser(user),
  };
}