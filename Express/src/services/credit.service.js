// Credit service: business logic and JSON persistence for organization credit balances.
// Stores records in `src/data/credits.json` keyed by `orgId`.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getOrgById } from "./auth.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const creditsPath = path.join(__dirname, "../data/credits.json");

async function readCredits() {
  const fileContents = await readFile(creditsPath, "utf8");
  const parsed = JSON.parse(fileContents);
  return Array.isArray(parsed.credits) ? parsed.credits : [];
}

async function writeCredits(credits) {
  await writeFile(creditsPath, `${JSON.stringify({ credits }, null, 2)}\n`, "utf8");
}

function normalizeOrgId(orgId) {
  return String(orgId || "").trim();
}

function normalizePositiveTokens(value) {
  const tokens = Number(value);
  if (!Number.isFinite(tokens) || !Number.isInteger(tokens) || tokens <= 0) {
    throw Object.assign(new Error("tokens must be a positive integer"), { status: 400 });
  }

  return tokens;
}

function toPublicCredit(record) {
  return {
    orgId: record.orgId,
    creditTokens: record.creditTokens,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

async function assertOrgExists(orgId) {
  const org = await getOrgById(orgId);
  if (!org) {
    throw Object.assign(new Error("Organization not found"), { status: 404 });
  }
}

export async function getOrgCreditBalance(orgId) {
  const normalizedOrgId = normalizeOrgId(orgId);
  if (!normalizedOrgId) {
    throw Object.assign(new Error("orgId is required"), { status: 400 });
  }

  await assertOrgExists(normalizedOrgId);

  const credits = await readCredits();
  const record = credits.find((entry) => entry.orgId === normalizedOrgId);

  if (!record) {
    return toPublicCredit({
      orgId: normalizedOrgId,
      creditTokens: 0,
      createdAt: null,
      updatedAt: null,
    });
  }

  return toPublicCredit(record);
}

export async function addOrgCreditTokens(orgId, tokens) {
  const normalizedOrgId = normalizeOrgId(orgId);
  if (!normalizedOrgId) {
    throw Object.assign(new Error("orgId is required"), { status: 400 });
  }

  await assertOrgExists(normalizedOrgId);

  const normalizedTokens = normalizePositiveTokens(tokens);
  const credits = await readCredits();
  const now = new Date().toISOString();
  const idx = credits.findIndex((entry) => entry.orgId === normalizedOrgId);

  let record;

  if (idx === -1) {
    record = {
      orgId: normalizedOrgId,
      creditTokens: normalizedTokens,
      createdAt: now,
      updatedAt: now,
    };
    credits.push(record);
  } else {
    record = {
      ...credits[idx],
      creditTokens: Number(credits[idx].creditTokens || 0) + normalizedTokens,
      updatedAt: now,
    };
    credits[idx] = record;
  }

  await writeCredits(credits);
  return toPublicCredit(record);
}

export async function subtractOrgCreditTokens(orgId, tokens) {
  const normalizedOrgId = normalizeOrgId(orgId);
  if (!normalizedOrgId) {
    throw Object.assign(new Error("orgId is required"), { status: 400 });
  }

  await assertOrgExists(normalizedOrgId);

  const normalizedTokens = normalizePositiveTokens(tokens);
  const credits = await readCredits();
  const idx = credits.findIndex((entry) => entry.orgId === normalizedOrgId);
  const currentTokens = idx === -1 ? 0 : Number(credits[idx].creditTokens || 0);

  if (currentTokens < normalizedTokens) {
    throw Object.assign(new Error("Insufficient credits"), { status: 402 });
  }

  const now = new Date().toISOString();
  const record = {
    ...(credits[idx] || { orgId: normalizedOrgId, createdAt: now }),
    orgId: normalizedOrgId,
    creditTokens: currentTokens - normalizedTokens,
    updatedAt: now,
  };

  if (idx === -1) {
    credits.push(record);
  } else {
    credits[idx] = record;
  }

  await writeCredits(credits);
  return toPublicCredit(record);
}