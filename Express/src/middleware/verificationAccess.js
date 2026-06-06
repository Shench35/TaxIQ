// Verification access middleware: allows either JWT auth or a valid org API key.
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_PATH = path.join(__dirname, '../data/users.json');

async function readOrgs() {
  const txt = await readFile(USERS_PATH, 'utf8');
  return JSON.parse(txt).users || [];
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex');
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

export async function verificationAccess(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const orgs = await readOrgs();
      const org = orgs.find((entry) => entry.id === decoded.id);

      if (!org) {
        return res.status(401).json({ success: false, error: 'Organization not found' });
      }

      req.org = toPublicOrg(org);
      req.verificationAuthType = 'jwt';
      return next();
    } catch (error) {
      return res.status(401).json({ success: false, error: error.name === 'TokenExpiredError' ? 'Session expired — please log in again' : 'Unauthorised — invalid token' });
    }
  }

  const apiKey = req.get('x-api-key');
  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'Unauthorised — no token or API key provided' });
  }

  try {
    const orgs = await readOrgs();
    const apiKeyHash = hashApiKey(apiKey);

    for (const org of orgs) {
      const apiKeys = Array.isArray(org.apiKeys) ? org.apiKeys : [];
      const activeKey = apiKeys.find((entry) => entry.keyHash === apiKeyHash && !entry.revokedAt);

      if (activeKey) {
        req.org = toPublicOrg(org);
        req.verificationAuthType = 'apiKey';
        req.verificationApiKeyId = activeKey.id;
        return next();
      }
    }

    return res.status(401).json({ success: false, error: 'Unauthorised — invalid API key' });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Unauthorised — invalid API key' });
  }
}