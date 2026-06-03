// Protected organization routes (requires JWT)
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getProfile, updateProfile } from '../controllers/org.controller.js';

const router = Router();

// simple root returns authenticated org summary
router.get('/', authMiddleware, (req, res) => {
  res.json({ success: true, org: req.org });
});

// GET /api/org/profile - full profile including createdAt
router.get('/profile', authMiddleware, getProfile);

// PUT /api/org/profile - update mutable profile fields
router.put('/profile', authMiddleware, updateProfile);

export default router;
