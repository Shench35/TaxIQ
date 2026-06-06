// Verification controller: handles certificate uploads, mock AI analysis, result storage, and credit deduction.
import { getOrgCreditBalance, subtractOrgCreditTokens } from '../services/credit.service.js';
import {
  createVerificationResult,
  deleteStoredCertificate,
  getVerificationResultById,
  removeVerificationResult,
  listVerificationResults,
  runMockFastApiVerification,
  saveCertificateUpload,
} from '../services/verifications.service.js';
import { v4 as uuidv4 } from 'uuid';

function resolvePage(req) {
  return req.query.page || 1;
}

function toPagedResponse(payload) {
  return {
    success: true,
    ...payload,
  };
}

export async function getVerifications(req, res, next) {
  try {
    const org = req.org;
    if (!org?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorised' });
    }

    const page = resolvePage(req);
    const result = await listVerificationResults({
      orgId: org.id,
      authType: req.verificationAuthType || 'jwt',
      apiKeyId: req.verificationApiKeyId || null,
      page,
      perPage: 10,
    });

    return res.json(toPagedResponse(result));
  } catch (error) {
    return next(error);
  }
}

export async function getVerificationById(req, res, next) {
  try {
    const org = req.org;
    if (!org?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorised' });
    }

    const verification = await getVerificationResultById({
      id: req.params.id,
      orgId: org.id,
      authType: req.verificationAuthType || 'jwt',
      apiKeyId: req.verificationApiKeyId || null,
    });

    if (!verification) {
      return res.status(404).json({ success: false, error: 'Verification not found' });
    }

    return res.json({ success: true, verification });
  } catch (error) {
    return next(error);
  }
}

export async function submitVerification(req, res, next) {
  const savedUpload = { storedFileName: null, filesystemPath: null };
  let verificationRecord = null;

  try {
    const org = req.org;
    if (!org?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorised' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'certificate file is required' });
    }

    const credit = await getOrgCreditBalance(org.id);
    if (Number(credit.creditTokens || 0) < 1) {
      return res.status(402).json({ success: false, error: 'Insufficient credits' });
    }

    const upload = await saveCertificateUpload(file);
    savedUpload.storedFileName = upload.storedFileName;
    savedUpload.filesystemPath = upload.filesystemPath;

    const verificationId = uuidv4();
    const aiResult = await runMockFastApiVerification({ org, file, verificationId });

    verificationRecord = await createVerificationResult({
      id: verificationId,
      orgId: org.id,
      orgName: org.orgName,
      authType: req.verificationAuthType || 'unknown',
      apiKeyId: req.verificationApiKeyId || null,
      originalFileName: file.originalname || null,
      storedFileName: upload.storedFileName,
      storedPath: upload.storedPath,
      mimeType: file.mimetype || null,
      sizeBytes: file.size || 0,
      aiResult,
      creditCost: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      const updatedCredit = await subtractOrgCreditTokens(org.id, 1);
      return res.status(201).json({
        success: true,
        verification: verificationRecord,
        credit: updatedCredit,
      });
    } catch (deductionError) {
      await removeVerificationResult(verificationRecord.id);
      await deleteStoredCertificate(upload.storedFileName);
      return next(deductionError);
    }
  } catch (error) {
    if (verificationRecord?.id) {
      await removeVerificationResult(verificationRecord.id).catch(() => {});
    }
    if (savedUpload.storedFileName) {
      await deleteStoredCertificate(savedUpload.storedFileName).catch(() => {});
    }
    return next(error);
  }
}