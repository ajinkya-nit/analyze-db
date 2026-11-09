

// This file will validate the configuration submitted by the frontend when a user wants to register a database connection.

import {
  isNonEmptyString,
  isValidPort,
  isValidLength,
} from '../utils/validate.js';

export function validateDatabaseConnection(req) {
  const errors = [];
  const body = req.body;

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return ['Request body must be a JSON object'];
  }

  // Host
  if (!isNonEmptyString(body.host)) {
    errors.push('Host is required and must be a non-empty string');
  } else if (!isValidLength(body.host, 1, 255)) {
    errors.push('Host must be between 1 and 255 characters');
  }

  // Port
  if (!isValidPort(body.port)) {
    errors.push('Port must be an integer between 1 and 65535');
  }

  // Username
  if (!isNonEmptyString(body.username)) {
    errors.push('Username is required');
  } else if (!isValidLength(body.username, 1, 128)) {
    errors.push('Username must not exceed 128 characters');
  }

  // Password
  if (!isNonEmptyString(body.password)) {
    errors.push('Password is required');
  } else if (body.password.length > 1024) {
    errors.push('Password must not exceed 1024 characters');
  }

  // Database
  if (!isNonEmptyString(body.database)) {
    errors.push('Database name is required');
  } else if (!isValidLength(body.database, 1, 128)) {
    errors.push('Database name must not exceed 128 characters');
  }

  
  return errors;
}

export function validateCreateDatabaseConnection(req) {
  const errors = validateDatabaseConnection(req);

  if (!isNonEmptyString(req.body?.name)) {
    errors.push('Connection name is required');
  } else if (!isValidLength(req.body.name, 1, 150)) {
    errors.push('Connection name must not exceed 150 characters');
  }

  return errors;
}