// JWT auth middleware that verifies token and attaches `req.org`.
import jwt from 'jsonwebtoken';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_PATH = path.join(__dirname, '../data/users.json');

async function readOrgs() {
  const txt = await readFile(USERS_PATH, 'utf8');
  return JSON.parse(txt).users || [];
}

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ success: false, error: 'Unauthorised — no token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const orgs = await readOrgs();
    const org = orgs.find((o) => o.id === decoded.id);
    if (!org) return res.status(401).json({ success: false, error: 'Organization not found' });
    req.org = { id: org.id, email: org.email, orgName: org.orgName, orgAddress: org.orgAddress, phoneNumber: org.phoneNumber };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: err.name === 'TokenExpiredError' ? 'Session expired — please log in again' : 'Unauthorised — invalid token' });
  }
}
