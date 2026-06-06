// API key routes: protected endpoints for listing, creating, and revoking keys.
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { createKey, deleteKey, getKeys } from '../controllers/keys.controller.js';

const router = Router();

router.get('/', authMiddleware, getKeys);
router.post('/', authMiddleware, createKey);
router.delete('/:id', authMiddleware, deleteKey);

export default router;
