import {
  createProjectDatabaseConnection,
  getProjectDatabaseConnections,
  getProjectDatabaseConnection,
  deleteProjectDatabaseConnection,
  testSavedProjectDatabaseConnection,
} from '../services/database-connection.service.js';

export async function createConnection(req, res) {
  const connection = await createProjectDatabaseConnection(
    req.params.projectId,
    req.user.id,
    req.body
  );

  return res.status(201).json({
    success: true,
    message: 'Database connection saved successfully.',
    data: connection,
  });
}

export async function getConnections(req, res) {
  const connections = await getProjectDatabaseConnections(
    req.params.projectId,
    req.user.id
  );

  return res.status(200).json({
    success: true,
    message: 'Database connections retrieved successfully.',
    data: connections,
  });
}

export async function getConnection(req, res) {
  const connection = await getProjectDatabaseConnection(
    req.params.projectId,
    req.user.id,
    req.params.connectionId
  );

  return res.status(200).json({
    success: true,
    message: 'Database connection retrieved successfully.',
    data: connection,
  });
}

export async function deleteConnection(req, res) {
  await deleteProjectDatabaseConnection(
    req.params.projectId,
    req.user.id,
    req.params.connectionId
  );

  return res.status(200).json({
    success: true,
    message: 'Database connection deleted successfully.',
    data: null,
  });
}

export async function testSavedConnection(req, res) {
  const result = await testSavedProjectDatabaseConnection(
    req.params.projectId,
    req.user.id,
    req.params.connectionId
  );

  return res.status(200).json({
    success: true,
    message: 'Saved database connection tested successfully.',
    data: result,
  });
}