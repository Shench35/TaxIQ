// Credit controller: read and add credit tokens for organizations.
// GET returns the current balance; PUT/top-up accepts tokens from a payment webhook.
import { getOrgCreditBalance, addOrgCreditTokens } from "../services/credit.service.js";

function resolveOrgId(req) {
  return req.params.orgId || req.query.orgId || req.body.orgId || (req.org && req.org.id) || "";
}

function resolveTokensPayload(body) {
  return body.tokens ?? body.amount ?? body.creditTokens ?? body.credits;
}

function assertWebhookSecret(req) {
  const expectedSecret = process.env.CREDIT_WEBHOOK_SECRET;
  if (!expectedSecret) return;

  const providedSecret = req.get("x-credit-secret");
  if (providedSecret !== expectedSecret) {
    throw Object.assign(new Error("Unauthorised"), { status: 401 });
  }
}

export async function getCreditBalance(req, res, next) {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: "orgId is required" });
    }

    const credit = await getOrgCreditBalance(orgId);
    return res.json({ success: true, credit });
  } catch (error) {
    return next(error);
  }
}

export async function addCreditTokens(req, res, next) {
  try {
    // assertWebhookSecret(req);

    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, error: "orgId is required" });
    }

    const tokens = resolveTokensPayload(req.body);
    const credit = await addOrgCreditTokens(orgId, tokens);
    return res.status(200).json({ success: true, credit });
  } catch (error) {
    return next(error);
  }
}