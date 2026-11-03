import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';

export function notFoundHandler(req, res, next) {
  next(
    new ApiError(
      404,
      `Route not found: ${req.method} ${req.originalUrl}`
    )
  );
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const isOperational = err instanceof ApiError;

  const statusCode =
    isOperational &&
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
      : 500;

  const message = isOperational
    ? err.message
    : 'Internal server error';

  const logData = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    errorName: err.name,
    errorMessage: err.message,
  };

  if (statusCode >= 500) {
    logger.error(logData, 'API request failed');
  } else {
    logger.warn(logData, 'API request rejected');
  }

  return res.status(statusCode).json({
    success: false,
    message,
    errors: isOperational ? err.errors : [],
  });
}