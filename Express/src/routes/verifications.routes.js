// Verification routes: list results, fetch a single result, and accept certificate uploads.
import { Router } from 'express';
import multer from 'multer';
import { verificationAccess } from '../middleware/verificationAccess.js';
import { getVerificationById, getVerifications, submitVerification } from '../controllers/verifications.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, cb) {
    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
    ]);

    if (allowedMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }

    return cb(Object.assign(new Error('Only PDF, PNG, JPEG, and WEBP files are allowed'), { status: 400 }));
  },
});

const router = Router();

router.get('/', verificationAccess, getVerifications);
router.get('/:id', verificationAccess, getVerificationById);
router.post('/', verificationAccess, upload.single('certificate'), submitVerification);

export default router;