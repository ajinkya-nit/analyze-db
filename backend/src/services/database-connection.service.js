import {
  encryptCredential,
  decryptCredential,
} from '../utils/credential-encryption.js';

import * as projectRepository from '../repositories/project.repository.js';

import * as connectionRepository from '../repositories/database-connection.repository.js';

import mysql from 'mysql2/promise';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';

export async function verifyDatabaseConnection(config) {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: config.host.trim(),
      port: Number(config.port),
      user: config.username.trim(),
      password: config.password,
      database: config.database.trim(),
      connectTimeout: 5000,
      multipleStatements: false,
    });

    await connection.query('SELECT 1 AS connected');

    return {
      connected: true,
      host: config.host,
      database: config.database,
    };
  } catch (error) {
    logger.warn(
      {
        errorCode: error.code || 'UNKNOWN',
        requestOperation: 'database_connection_verification',
      },
      'Customer database connection failed'
    );

    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      throw new ApiError(
        422,
        'Database authentication failed. Check the username and password.'
      );
    }

    if (
      error.code === 'ETIMEDOUT' ||
      error.code === 'PROTOCOL_CONNECTION_LOST'
    ) {
      throw new ApiError(
        504,
        'Database connection timed out or was interrupted.'
      );
    }

    throw new ApiError(
      502,
      'Unable to connect to the specified database. Check the host, port, and database availability.'
    );
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch {
        
      }
    }
  }
}
async function ensureProjectOwnership(projectId, userId) {
  const project = await projectRepository.findProjectById(
    projectId,
    userId
  );

  if (!project) {
    throw new ApiError(404, 'Project not found.');
  }

  return project;
}

export async function createProjectDatabaseConnection(
  projectId,
  userId,
  config
) {
  await ensureProjectOwnership(projectId, userId);

  await verifyDatabaseConnection(config);

  const passwordEncrypted = encryptCredential(config.password);

  const savedConnection =
    await connectionRepository.createDatabaseConnection({
      projectId,
      name: config.name,
      engine: 'mysql',
      host: config.host.trim(),
      port: Number(config.port),
      databaseName: config.database.trim(),
      username: config.username.trim(),
      passwordEncrypted,
    });

  return savedConnection;
}

export async function getProjectDatabaseConnections(
  projectId,
  userId
) {
  await ensureProjectOwnership(projectId, userId);

  return connectionRepository.findDatabaseConnectionsByProjectId(
    projectId
  );
}

export async function getProjectDatabaseConnection(
  projectId,
  userId,
  connectionId
) {
  await ensureProjectOwnership(projectId, userId);

  const connection =
    await connectionRepository.findDatabaseConnectionById(
      connectionId,
      projectId
    );

  if (!connection) {
    throw new ApiError(404, 'Database connection not found.');
  }

  return connection;
}

export async function deleteProjectDatabaseConnection(
  projectId,
  userId,
  connectionId
) {
  await ensureProjectOwnership(projectId, userId);

  const deleted =
    await connectionRepository.deleteDatabaseConnection(
      connectionId,
      projectId
    );

  if (!deleted) {
    throw new ApiError(404, 'Database connection not found.');
  }

  return true;
}

export async function testSavedProjectDatabaseConnection(
  projectId,
  userId,
  connectionId
) {
  // 1. Verify that this project belongs to the authenticated user.
  await ensureProjectOwnership(projectId, userId);

  // 2. Retrieve safe connection metadata.
  const connection =
    await connectionRepository.findDatabaseConnectionById(
      connectionId,
      projectId
    );

  if (!connection) {
    throw new ApiError(404, 'Database connection not found.');
  }

  // 3. This implementation currently supports MySQL only.
  if (connection.engine !== 'mysql') {
    throw new ApiError(
      400,
      'Testing this database engine is not supported yet.'
    );
  }

  // 4. Retrieve the encrypted password separately.
  const credential =
    await connectionRepository.findEncryptedCredential(
      connectionId,
      projectId
    );

  if (!credential || !credential.password_encrypted) {
    throw new ApiError(
      500,
      'Saved database credentials are unavailable.'
    );
  }

  // 5. Decrypt the password inside the backend.
  let password;

  try {
    password = decryptCredential(credential.password_encrypted);
  } catch {
    logger.error(
      { requestOperation: 'saved_database_credential_decryption' },
      'Unable to decrypt saved database credentials'
    );

    await connectionRepository.updateConnectionStatus(
      connectionId,
      projectId,
      'failed'
    );

    throw new ApiError(
      500,
      'Saved database credentials could not be decrypted. Check the encryption key configuration.'
    );
  }

  // Test the external MySQL connection.
  try {
    const result = await verifyDatabaseConnection({
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password,
      database: connection.database_name,
    });

    // Record a successful connection test.
    const updatedConnection =
      await connectionRepository.updateConnectionStatus(
        connectionId,
        projectId,
        'connected'
      );

    if (!updatedConnection) {
      throw new ApiError(404, 'Database connection no longer exists.');
    }

    return {
      ...updatedConnection,
      testResult: result,
    };
  } catch (error) {
    // Record a failed test without exposing credentials.
    try {
      await connectionRepository.updateConnectionStatus(
        connectionId,
        projectId,
        'failed'
      );
    } catch {
      logger.error(
        { requestOperation: 'database_connection_status_update' },
        'Unable to update database connection status'
      );
    }

    throw error;
  } finally {
    // Remove the local reference to the decrypted password.
    password = undefined;
  }
}