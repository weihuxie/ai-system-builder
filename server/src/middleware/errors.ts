import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError, ApiErrorCode } from '@asb/shared';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  toJSON(): ApiError {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' } satisfies ApiError);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.toJSON());
    return;
  }
  // Unknown: log for ops, return 500
  // eslint-disable-next-line no-console
  console.error('[asb/server] unhandled error:', err);
  res.status(500).json({ code: 'INTERNAL', message: 'Internal server error' } satisfies ApiError);
};
