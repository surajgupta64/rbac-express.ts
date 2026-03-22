import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { LoginSchema, RefreshSchema, ChangePasswordSchema } from './auth.validation';
import { usersRepository } from '../users/users.repository';
import { ERROR_CODES } from '../core/constants/errors.constants';

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        statusCode: 400,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.errors.map((e) => e.message).join(', '),
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await authService.login(parsed.data.email, parsed.data.password, ip);

    res.status(200).json({
      statusCode: 200,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        statusCode: 400,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.errors.map((e) => e.message).join(', '),
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }

    const result = await authService.refresh(parsed.data.refreshToken);
    res.status(200).json({
      statusCode: 200,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.headers.authorization!.split(' ')[1];
    const refreshToken = req.body?.refreshToken || '';

    // Decode to get exp claim for blacklist TTL
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token) as { exp: number };

    await authService.logout(token, refreshToken, decoded.exp);

    res.status(200).json({
      statusCode: 200,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await usersRepository.findById(req.user.id);
    if (!user) {
      res.status(404).json({
        statusCode: 404,
        error: ERROR_CODES.NOT_FOUND,
        message: 'User not found',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }

    res.status(200).json({
      statusCode: 200,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        orgId: user.org_id,
        departmentId: user.department_id,
        isActive: user.is_active,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        statusCode: 400,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.errors.map((e) => e.message).join(', '),
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }

    await authService.changePassword(
      req.user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );

    res.status(200).json({
      statusCode: 200,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (err) {
    next(err);
  }
}
