// API keys controller: list, create and revoke API keys for the authenticated organization.
import { createApiKey, listApiKeys, revokeApiKey } from '../services/keys.service.js';

export async function getKeys(req, res, next) {
  try {
    const orgId = req.org && req.org.id;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorised' });

    const apiKeys = await listApiKeys(orgId);
    return res.json({ success: true, apiKeys });
  } catch (err) {
    return next(err);
  }
}

export async function createKey(req, res, next) {
  try {
    const orgId = req.org && req.org.id;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorised' });

    const result = await createApiKey(orgId);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return next(err);
  }
}

export async function deleteKey(req, res, next) {
  try {
    const orgId = req.org && req.org.id;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorised' });

    const apiKeyId = req.params.id;
    if (!apiKeyId) {
      return res.status(400).json({ success: false, error: 'API key id is required' });
    }

    const revokedKey = await revokeApiKey(orgId, apiKeyId);
    return res.json({ success: true, apiKey: revokedKey });
  } catch (err) {
    return next(err);
  }
}
