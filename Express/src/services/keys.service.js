import crypto from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usersPath = path.join(__dirname, '../data/users.json');

async function readOrgs() {
  const fileContents = await readFile(usersPath, 'utf8');
  const parsed = JSON.parse(fileContents);
  return Array.isArray(parsed.users) ? parsed.users : [];
}

async function writeOrgs(users) {
  await writeFile(usersPath, `${JSON.stringify({ users }, null, 2)}\n`, 'utf8');
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

function toPublicApiKey(apiKey) {
  return {
    id: apiKey.id,
    maskedKey: `****${apiKey.keyLast4}`,
    keyLast4: apiKey.keyLast4,
    createdAt: apiKey.createdAt,
    revokedAt: apiKey.revokedAt || null,
    status: apiKey.revokedAt ? 'revoked' : 'active',
  };
}

function getOrgApiKeys(org) {
  return Array.isArray(org.apiKeys) ? org.apiKeys : [];
}

export async function listApiKeys(orgId) {
  const orgs = await readOrgs();
  const org = orgs.find((entry) => entry.id === orgId);
  if (!org) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const apiKeys = getOrgApiKeys(org)
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map(toPublicApiKey);

  return apiKeys;
}

export async function createApiKey(orgId) {
  const orgs = await readOrgs();
  const idx = orgs.findIndex((entry) => entry.id === orgId);
  if (idx === -1) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const plainApiKey = generateApiKey();
  const apiKeyRecord = {
    id: uuidv4(),
    keyHash: hashApiKey(plainApiKey),
    keyLast4: plainApiKey.slice(-4),
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };

  const org = orgs[idx];
  const apiKeys = getOrgApiKeys(org);
  org.apiKeys = [...apiKeys, apiKeyRecord];
  org.updatedAt = new Date().toISOString();
  orgs[idx] = org;

  await writeOrgs(orgs);

  return {
    apiKey: plainApiKey,
    key: toPublicApiKey(apiKeyRecord),
  };
}

export async function revokeApiKey(orgId, apiKeyId) {
  const orgs = await readOrgs();
  const idx = orgs.findIndex((entry) => entry.id === orgId);
  if (idx === -1) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const org = orgs[idx];
  const apiKeys = getOrgApiKeys(org);
  const keyIdx = apiKeys.findIndex((entry) => entry.id === apiKeyId);

  if (keyIdx === -1) {
    throw Object.assign(new Error('API key not found'), { status: 404 });
  }

  if (apiKeys[keyIdx].revokedAt) {
    throw Object.assign(new Error('API key is already revoked'), { status: 409 });
  }

  apiKeys[keyIdx] = {
    ...apiKeys[keyIdx],
    revokedAt: new Date().toISOString(),
  };

  org.apiKeys = apiKeys;
  org.updatedAt = new Date().toISOString();
  orgs[idx] = org;

  await writeOrgs(orgs);

  return toPublicApiKey(apiKeys[keyIdx]);
}
