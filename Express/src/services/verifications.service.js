// Verification service: saves uploaded certificates, mocks FastAPI analysis, and persists results.
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CERTS_DIR = path.join(__dirname, '../certs');
const VERIFICATIONS_PATH = path.join(__dirname, '../data/verifications.json');

async function ensureStorage() {
  await mkdir(CERTS_DIR, { recursive: true });
}

async function readVerifications() {
  const fileContents = await readFile(VERIFICATIONS_PATH, 'utf8');
  const parsed = JSON.parse(fileContents);
  return Array.isArray(parsed.verifications) ? parsed.verifications : [];
}

async function writeVerifications(verifications) {
  await writeFile(VERIFICATIONS_PATH, `${JSON.stringify({ verifications }, null, 2)}\n`, 'utf8');
}

function getSafeExtension(file) {
  const originalName = String(file?.originalname || '').toLowerCase();
  if (originalName.endsWith('.pdf')) return '.pdf';
  if (originalName.endsWith('.png')) return '.png';
  if (originalName.endsWith('.jpg')) return '.jpg';
  if (originalName.endsWith('.jpeg')) return '.jpeg';
  if (originalName.endsWith('.webp')) return '.webp';

  if (file?.mimetype === 'application/pdf') return '.pdf';
  if (file?.mimetype === 'image/png') return '.png';
  if (file?.mimetype === 'image/jpeg') return '.jpg';
  if (file?.mimetype === 'image/webp') return '.webp';

  return '.bin';
}

function buildMockAiResult({ org, file, verificationId }) {
  const source = `${file.originalname || ''} ${file.mimetype || ''}`.toLowerCase();
  const looksRejected = source.includes('invalid') || source.includes('fake') || source.includes('forged');
  const looksNeedsReview = source.includes('review') || source.includes('unclear') || source.includes('blurry');

  const status = looksRejected ? 'rejected' : looksNeedsReview ? 'needs_review' : 'verified';
  const confidence = looksRejected ? 0.18 : looksNeedsReview ? 0.61 : 0.94;

  return {
    provider: 'fastapi-ai-mock',
    model: 'certificate-verifier-mock-v1',
    verificationId,
    status,
    confidence,
    summary: `Mocked analysis for ${org.orgName}.`,
    checks: {
      fileName: file.originalname || null,
      mimeType: file.mimetype || null,
      sizeBytes: file.size || 0,
    },
    extracted: {
      certificateNumber: null,
      holderName: null,
      issuer: null,
      issueDate: null,
      expiryDate: null,
    },
  };
}

export async function saveCertificateUpload(file) {
  await ensureStorage();

  const storedFileName = `${Date.now()}-${uuidv4()}${getSafeExtension(file)}`;
  const filesystemPath = path.join(CERTS_DIR, storedFileName);
  await writeFile(filesystemPath, file.buffer);

  return {
    storedFileName,
    storedPath: `src/certs/${storedFileName}`,
    filesystemPath,
  };
}

export async function createVerificationResult(record) {
  const verifications = await readVerifications();
  verifications.push(record);
  await writeVerifications(verifications);
  return record;
}

export async function listVerificationResults({ orgId, authType, apiKeyId, page = 1, perPage = 10 }) {
  const normalizedOrgId = String(orgId || '').trim();
  const normalizedApiKeyId = String(apiKeyId || '').trim();
  const currentPage = Number.parseInt(page, 10);
  const pageSize = Number.parseInt(perPage, 10);

  const safePage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
  const safePerPage = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10;

  const verifications = await readVerifications();
  const filtered = verifications.filter((entry) => {
    if (normalizedOrgId && entry.orgId !== normalizedOrgId) {
      return false;
    }

    if (authType === 'apiKey') {
      return entry.apiKeyId === normalizedApiKeyId;
    }

    return true;
  });

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safePerPage);
  const offset = (safePage - 1) * safePerPage;
  const items = filtered
    .slice()
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
    .slice(offset, offset + safePerPage);

  return {
    verifications: items,
    page: safePage,
    perPage: safePerPage,
    total,
    totalPages,
  };
}

export async function getVerificationResultById({ id, orgId, authType, apiKeyId }) {
  const normalizedId = String(id || '').trim();
  const normalizedOrgId = String(orgId || '').trim();
  const normalizedApiKeyId = String(apiKeyId || '').trim();

  if (!normalizedId) {
    throw Object.assign(new Error('verification id is required'), { status: 400 });
  }

  const verifications = await readVerifications();
  const record = verifications.find((entry) => entry.id === normalizedId);

  if (!record) {
    return null;
  }

  if (normalizedOrgId && record.orgId !== normalizedOrgId) {
    return null;
  }

  if (authType === 'apiKey' && record.apiKeyId !== normalizedApiKeyId) {
    return null;
  }

  return record;
}

export async function removeVerificationResult(recordId) {
  const verifications = await readVerifications();
  const idx = verifications.findIndex((entry) => entry.id === recordId);

  if (idx === -1) {
    return null;
  }

  const [removed] = verifications.splice(idx, 1);
  await writeVerifications(verifications);
  return removed;
}

export async function deleteStoredCertificate(storedFileName) {
  if (!storedFileName) return;

  const filesystemPath = path.join(CERTS_DIR, storedFileName);
  try {
    await unlink(filesystemPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function runMockFastApiVerification({ org, file, verificationId }) {
  return buildMockAiResult({ org, file, verificationId });
}