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
