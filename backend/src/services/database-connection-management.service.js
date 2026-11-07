import * as connectionRepository from '../repositories/database-connection.repository.js';
import * as projectService from './project.service.js';
import { verifyDatabaseConnection } from './database-connection.service.js';
import ApiError from '../utils/ApiError.js';

// Create a saved database connection record.
export async function createDatabaseConnection(userId, projectId, data) {
  if (!projectId || !userId) {
    throw new ApiError(400, 'User ID and project ID are required.');
  }

  const {
    name,
    engine,
    host,
    port,
    databaseName,
    username,
  } = data ?? {};

  await projectService.getProjectById(projectId, userId);

  if (typeof name !== 'string' || !name.trim() || name.trim().length > 150) {
    throw new ApiError(400, 'Connection name must be between 1 and 150 characters.');
  }

  if (!['mysql', 'postgresql'].includes(engine)) {
    throw new ApiError(400, 'Unsupported database engine.');
  }

  if (typeof host !== 'string' || !host.trim() || host.trim().length > 255) {
    throw new ApiError(400, 'A valid database host is required.');
  }

  if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
    throw new ApiError(400, 'A valid database port is required.');
  }

  if (
    typeof databaseName !== 'string' ||
    !databaseName.trim() ||
    databaseName.trim().length > 255
  ) {
    throw new ApiError(400, 'A valid database name is required.');
  }

  if (
    typeof username !== 'string' ||
    !username.trim() ||
    username.trim().length > 255
  ) {
    throw new ApiError(400, 'A valid database username is required.');
  }

  return connectionRepository.createDatabaseConnection({
    projectId,
    name: name.trim(),
    engine,
    host: host.trim(),
    port: Number(port),
    databaseName: databaseName.trim(),
    username: username.trim(),
  });
}

// Get one connection belonging to an owned project.
export async function getDatabaseConnection(userId, projectId, connectionId) {
  await projectService.getProjectById(projectId, userId);

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

// Get all connections for an owned project.
export async function getProjectDatabaseConnections(userId, projectId) {
  await projectService.getProjectById(projectId, userId);

  return connectionRepository.findDatabaseConnectionsByProjectId(projectId);
}

// Update saved connection metadata.
export async function updateDatabaseConnection(
  userId,
  projectId,
  connectionId,
  updates
) {
  await projectService.getProjectById(projectId, userId);

  const allowedFields = [
    'name',
    'host',
    'port',
    'databaseName',
    'username',
  ];

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new ApiError(400, 'Invalid connection update data.');
  }

  const hasAllowedField = allowedFields.some(
    (field) => Object.hasOwn(updates, field)
  );

  if (!hasAllowedField) {
    throw new ApiError(400, 'No valid connection fields were provided.');
  }

  if (Object.hasOwn(updates, 'name')) {
    if (
      typeof updates.name !== 'string' ||
      !updates.name.trim() ||
      updates.name.trim().length > 150
    ) {
      throw new ApiError(400, 'Connection name must be between 1 and 150 characters.');
    }
  }

  if (Object.hasOwn(updates, 'host')) {
    if (
      typeof updates.host !== 'string' ||
      !updates.host.trim() ||
      updates.host.trim().length > 255
    ) {
      throw new ApiError(400, 'A valid database host is required.');
    }
  }

  if (Object.hasOwn(updates, 'port')) {
    if (
      !Number.isInteger(Number(updates.port)) ||
      Number(updates.port) < 1 ||
      Number(updates.port) > 65535
    ) {
      throw new ApiError(400, 'A valid database port is required.');
    }
  }

  if (Object.hasOwn(updates, 'databaseName')) {
    if (
      typeof updates.databaseName !== 'string' ||
      !updates.databaseName.trim() ||
      updates.databaseName.trim().length > 255
    ) {
      throw new ApiError(400, 'A valid database name is required.');
    }
  }

  if (Object.hasOwn(updates, 'username')) {
    if (
      typeof updates.username !== 'string' ||
      !updates.username.trim() ||
      updates.username.trim().length > 255
    ) {
      throw new ApiError(400, 'A valid database username is required.');
    }
  }

  const connection = await connectionRepository.updateDatabaseConnection(
    connectionId,
    projectId,
    {
      ...updates,
      name: updates.name?.trim(),
      host: updates.host?.trim(),
      databaseName: updates.databaseName?.trim(),
      username: updates.username?.trim(),
      port: updates.port === undefined ? undefined : Number(updates.port),
    }
  );

  if (!connection) {
    throw new ApiError(404, 'Database connection not found.');
  }

  return connection;
}

// Test a saved database connection.
export async function testSavedDatabaseConnection(
  userId,
  projectId,
  connectionId,
  credentials
) {
  const savedConnection = await getDatabaseConnection(
    userId,
    projectId,
    connectionId
  );

  if (
    !credentials ||
    typeof credentials.password !== 'string'
  ) {
    throw new ApiError(400, 'Database password is required for connection testing.');
  }

  try {
    const result = await verifyDatabaseConnection({
      host: savedConnection.host,
      port: savedConnection.port,
      username: savedConnection.username,
      password: credentials.password,
      database: savedConnection.database_name,
    });

    await connectionRepository.updateConnectionStatus(
      connectionId,
      projectId,
      'connected'
    );

    return result;
  } catch (error) {
    await connectionRepository.updateConnectionStatus(
      connectionId,
      projectId,
      'failed'
    );

    throw error;
  }
}

// Delete a saved database connection.
export async function deleteDatabaseConnection(
  userId,
  projectId,
  connectionId
) {
  await projectService.getProjectById(projectId, userId);

  const deleted = await connectionRepository.deleteDatabaseConnection(
    connectionId,
    projectId
  );

  if (!deleted) {
    throw new ApiError(404, 'Database connection not found.');
  }

  return { deleted: true };
}