import postgresPool from '../database/postgres.connection.js';

// Create a database connection record.
export async function createDatabaseConnection({
  projectId,
  name,
  engine,
  host,
  port,
  databaseName,
  username,
}) {
  const result = await postgresPool.query(
    `INSERT INTO database_connections (
      project_id,
      name,
      engine,
      host,
      port,
      database_name,
      username
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      projectId,
      name,
      engine,
      host,
      port,
      databaseName,
      username,
    ]
  );

  return result.rows[0];
}

export async function findDatabaseConnectionById(
  connectionId,
  projectId
) {
  const result = await postgresPool.query(
    `SELECT *
     FROM database_connections
     WHERE id = $1 AND project_id = $2`,
    [connectionId, projectId]
  );

  return result.rows[0] ?? null;
}

// Get all connections belonging to a project.
export async function findDatabaseConnectionsByProjectId(projectId) {
  const result = await postgresPool.query(
    `SELECT *
     FROM database_connections
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId]
  );

  return result.rows;
}


export async function updateDatabaseConnection(
  connectionId,
  projectId,
  {
    name,
    host,
    port,
    databaseName,
    username,
  }
) {
  const result = await postgresPool.query(
    `UPDATE database_connections
     SET name = COALESCE($3, name),
         host = COALESCE($4, host),
         port = COALESCE($5, port),
         database_name = COALESCE($6, database_name),
         username = COALESCE($7, username),
         updated_at = NOW()
     WHERE id = $1 AND project_id = $2
     RETURNING *`,
    [
      connectionId,
      projectId,
      name ?? null,
      host ?? null,
      port ?? null,
      databaseName ?? null,
      username ?? null,
    ]
  );

  return result.rows[0] ?? null;
}

export async function updateConnectionStatus(
  connectionId,
  projectId,
  status
) {
  const result = await postgresPool.query(
    `UPDATE database_connections
     SET connection_status = $3,
         last_tested_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND project_id = $2
     RETURNING *`,
    [connectionId, projectId, status]
  );

  return result.rows[0] ?? null;
}

export async function deleteDatabaseConnection(
  connectionId,
  projectId
) {
  const result = await postgresPool.query(
    `DELETE FROM database_connections
     WHERE id = $1 AND project_id = $2
     RETURNING id`,
    [connectionId, projectId]
  );

  return result.rowCount > 0;
}