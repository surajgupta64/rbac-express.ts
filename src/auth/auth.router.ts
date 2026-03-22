import { Router } from 'express';
import { authMiddleware } from '../core/middleware/auth.middleware';
import * as authController from './auth.controller';

const router = Router();

// Public routes (no auth required)
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Protected routes (auth required)
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.me);
router.post('/password/change', authMiddleware, authController.changePassword);

export default router;
