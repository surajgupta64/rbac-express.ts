import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ─── PostgreSQL error handling ──────────────────────────────────
  if (err.code === '22P02') {
    // invalid_text_representation — typically invalid UUID format
    res.status(400).json({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: 'Invalid input syntax — likely an invalid UUID or data format',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
    return;
  }

  if (err.code === '23505') {
    // unique_violation
    res.status(409).json({
      statusCode: 409,
      error: 'DUPLICATE_ENTRY',
      message: 'A record with this value already exists',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
    return;
  }

  if (err.code === '23503') {
    // foreign_key_violation
    res.status(400).json({
      statusCode: 400,
      error: 'FOREIGN_KEY_VIOLATION',
      message: 'Referenced record does not exist or cannot be removed due to dependencies',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
    return;
  }

  // ─── Application errors (AppError or similar) ──────────────────
  const statusCode = err.statusCode ?? 500;

  if (statusCode === 500) {
    console.error('Unhandled error:', err);
  }

  res.status(statusCode).json({
    statusCode,
    error: err.code ?? 'INTERNAL_ERROR',
    message: err.message ?? 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    statusCode: 404,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}
