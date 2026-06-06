// Organization controller: provides profile retrieval and update endpoints.
import { getOrgById, updateOrgProfile } from '../services/auth.service.js';

function toPublicProfile(org) {
  return {
    id: org.id,
    email: org.email,
    orgName: org.orgName,
    orgAddress: org.orgAddress || null,
    phoneNumber: org.phoneNumber || null,
    createdAt: org.createdAt || null,
    updatedAt: org.updatedAt || null,
  };
}

export async function getProfile(req, res, next) {
  try {
    const orgId = req.org && req.org.id;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorised' });
    const org = await getOrgById(orgId);
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });
    return res.json({ success: true, org: toPublicProfile(org) });
  } catch (err) {
    return next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const orgId = req.org && req.org.id;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorised' });

    const updates = {};
    // allow updating these fields only
    if (typeof req.body.orgName !== 'undefined') updates.orgName = req.body.orgName;
    if (typeof req.body.orgAddress !== 'undefined') updates.orgAddress = req.body.orgAddress;
    if (typeof req.body.phoneNumber !== 'undefined') updates.phoneNumber = req.body.phoneNumber;
    if (typeof req.body.email !== 'undefined') updates.email = req.body.email;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No updatable fields provided' });
    }

    const updated = await updateOrgProfile(orgId, updates);
    return res.json({ success: true, org: toPublicProfile(updated) });
  } catch (err) {
    return next(err);
  }
}
