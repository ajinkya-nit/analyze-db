import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  redact: {
    paths: [
      'password',
      '*.password',
      'req.headers.authorization',
      'req.headers.cookie',
      '*.connectionString',
    ],
    censor: '[REDACTED]',
  },

  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;