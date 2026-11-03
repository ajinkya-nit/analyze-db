import { randomUUID } from 'node:crypto';
import logger from '../config/logger.js';

export function requestLogger(req, res, next) {
  const requestId = randomUUID();
  const startTime = process.hrtime.bigint();

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const duration = Number(
      process.hrtime.bigint() - startTime
    ) / 1_000_000;

    logger.info({
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(duration.toFixed(2)),
    }, 'HTTP request completed');
  });

  next();
}