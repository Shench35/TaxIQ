// Auth service: persistence helpers for organizations, password hashing, and JWT issuance.
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
  // Include orgName in token for quick identity checks
  return jwt.sign(
    { id: user.id, email: user.email, orgName: user.orgName },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function toPublicOrg(org) {
  return {
    id: org.id,
    email: org.email,
    orgName: org.orgName,
    orgAddress: org.orgAddress || null,
    phoneNumber: org.phoneNumber || null,
  };
}

function ensureMinimumPasswordStrength(password) {
  const s = String(password || "");
  if (s.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters"), { status: 400 });
  }
  // Require one upper, one lower, one digit, one symbol
  if (!/[A-Z]/.test(s) || !/[a-z]/.test(s) || !/[0-9]/.test(s) || !/[^A-Za-z0-9]/.test(s)) {
    throw Object.assign(new Error("Password must include upper, lower, digit and symbol"), { status: 400 });
  }
}

function validatePhone(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/[^0-9]/g, "");
  // simple check: 7-15 digits (E.164 up to 15)
  return digits.length >= 7 && digits.length <= 15;
}

export async function registerOrg({ orgName, orgAddress, email, phoneNumber, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw Object.assign(new Error("Email is required"), { status: 400 });
  }

  ensureMinimumPasswordStrength(password);

  if (!orgName || !String(orgName).trim()) {
    throw Object.assign(new Error("orgName is required"), { status: 400 });
  }

  if (!orgAddress || !String(orgAddress).trim()) {
    throw Object.assign(new Error("orgAddress is required"), { status: 400 });
  }

  if (phoneNumber && !validatePhone(phoneNumber)) {
    throw Object.assign(new Error("phoneNumber must be 7-15 digits"), { status: 400 });
  }

  const users = await readUsers();
  const existing = users.find((u) => u.email === normalizedEmail);

  if (existing) {
    throw Object.assign(new Error("Email already registered"), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const org = {
    id: uuidv4(),
    email: normalizedEmail,
    passwordHash,
    orgName: String(orgName).trim(),
    orgAddress: String(orgAddress).trim(),
    phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(org);
  await writeUsers(users);

  return { token: signToken(org), org: toPublicOrg(org) };
}

export async function loginOrg({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw Object.assign(new Error("Email is required"), { status: 400 });
  }

  const users = await readUsers();
  const org = users.find((entry) => entry.email === normalizedEmail);

  const passwordHash = org?.passwordHash || dummyPasswordHash;
  const isValidPassword = await bcrypt.compare(password, passwordHash);

  if (!org || !isValidPassword) {
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }

  return { token: signToken(org), org: toPublicOrg(org) };
}

export async function getOrgById(id) {
  if (!id) return null;
  const users = await readUsers();
  return users.find((u) => u.id === id) || null;
}

export async function updateOrgProfile(id, updates) {
  if (!id) throw Object.assign(new Error('Organization id is required'), { status: 400 });
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw Object.assign(new Error('Organization not found'), { status: 404 });

  const org = users[idx];

  // Prevent changing createdAt
  if ('createdAt' in updates) delete updates.createdAt;

  // Validate and apply updates
  if (typeof updates.email !== 'undefined') {
    const normalized = normalizeEmail(updates.email);
    if (!normalized) throw Object.assign(new Error('Email is invalid'), { status: 400 });
    // ensure uniqueness
    const conflict = users.find((u) => u.email === normalized && u.id !== id);
    if (conflict) throw Object.assign(new Error('Email already in use'), { status: 409 });
    org.email = normalized;
  }

  if (typeof updates.orgName !== 'undefined') {
    if (!updates.orgName || !String(updates.orgName).trim()) throw Object.assign(new Error('orgName is required'), { status: 400 });
    org.orgName = String(updates.orgName).trim();
  }

  if (typeof updates.orgAddress !== 'undefined') {
    if (!updates.orgAddress || !String(updates.orgAddress).trim()) throw Object.assign(new Error('orgAddress is required'), { status: 400 });
    org.orgAddress = String(updates.orgAddress).trim();
  }

  if (typeof updates.phoneNumber !== 'undefined') {
    if (updates.phoneNumber && !validatePhone(updates.phoneNumber)) throw Object.assign(new Error('phoneNumber must be 7-15 digits'), { status: 400 });
    org.phoneNumber = updates.phoneNumber ? String(updates.phoneNumber).trim() : null;
  }

  org.updatedAt = new Date().toISOString();

  users[idx] = org;
  await writeUsers(users);
  return org;
}