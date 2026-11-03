import ApiError from '../utils/ApiError.js';

export function notFoundHandler(req, res, next) {
  next(
    new ApiError(
      404,
      `Route not found: ${req.method} ${req.originalUrl}`
    )
  );
}

export function errorHandler(err, req, res, next) {
  const isOperational = err instanceof ApiError;

  const statusCode = isOperational ? err.statusCode : 500;

  const message = isOperational
    ? err.message
    : 'Internal server error';

  console.error('API Error:', err);

  return res.status(statusCode).json({
    success: false,
    message,
    errors: isOperational ? err.errors : [],
  });
}