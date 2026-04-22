import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError, ApiErrorCode } from '@asb/shared';

import { logEvent } from '../lib/logger.js';

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

export const notFoundHandler: RequestHandler = (req, res) => {
  logEvent('route_not_found', { method: req.method, path: req.path });
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' } satisfies ApiError);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.toJSON());
    return;
  }
  // Unknown: route-level handler didn't catch. Log enough to triage post-mortem.
  logEvent('unhandled_error', {
    method: req.method,
    path: req.path,
    message: (err as Error)?.message ?? String(err),
    stack: (err as Error)?.stack,
  });
  res.status(500).json({ code: 'INTERNAL', message: 'Internal server error' } satisfies ApiError);
};
