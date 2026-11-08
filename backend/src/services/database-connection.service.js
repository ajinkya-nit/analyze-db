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