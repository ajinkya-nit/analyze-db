
import postgresPool from '../database/postgres.connection.js';

const SAFE_CONNECTION_COLUMNS = `
  id,
  project_id,
  name,
  engine,
  host,
  port,
  database_name,
  username,
  connection_status,
  last_tested_at,
  created_at,
  updated_at
`;

export async function createDatabaseConnection({
  projectId,
  name,
  engine,
  host,
  port,
  databaseName,
  username,
  passwordEncrypted,
}) {
  const result = await postgresPool.query(
    `INSERT INTO database_connections (
      project_id,
      name,
      engine,
      host,
      port,
      database_name,
      username,
      password_encrypted
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING ${SAFE_CONNECTION_COLUMNS}`,
    [
      projectId,
      name,
      engine,
      host,
      port,
      databaseName,
      username,
      passwordEncrypted,
    ]
  );

  return result.rows[0];
}

export async function findDatabaseConnectionById(
  connectionId,
  projectId
) {
  const result = await postgresPool.query(
    `SELECT ${SAFE_CONNECTION_COLUMNS}
     FROM database_connections
     WHERE id = $1 AND project_id = $2`,
    [connectionId, projectId]
  );

  return result.rows[0] ?? null;
}

export async function findDatabaseConnectionsByProjectId(projectId) {
  const result = await postgresPool.query(
    `SELECT ${SAFE_CONNECTION_COLUMNS}
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
  const values = [connectionId, projectId];
  const setClauses = [];

  const fields = {
    name,
    host,
    port,
    database_name: databaseName,
    username,
  };

  for (const [column, value] of Object.entries(fields)) {
    if (value !== undefined) {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }
  }

  if (setClauses.length === 0) {
    return null;
  }

  setClauses.push('updated_at = NOW()');

  const result = await postgresPool.query(
    `UPDATE database_connections
     SET ${setClauses.join(', ')}
     WHERE id = $1 AND project_id = $2
     RETURNING ${SAFE_CONNECTION_COLUMNS}`,
    values
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
     RETURNING ${SAFE_CONNECTION_COLUMNS}`,
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


export async function findDatabaseConnectionCredentialsById(
  connectionId,
  projectId
) {
  const result = await postgresPool.query(
    `SELECT
       id,
       project_id,
       engine,
       host,
       port,
       database_name,
       username,
       password_encrypted
     FROM database_connections
     WHERE id = $1 AND project_id = $2`,
    [connectionId, projectId]
  );

  return result.rows[0] ?? null;
}

export async function findEncryptedCredential(
  connectionId,
  projectId
) {
  const result = await postgresPool.query(
    `SELECT password_encrypted
     FROM database_connections
     WHERE id = $1 AND project_id = $2`,
    [connectionId, projectId]
  );

  return result.rows[0] ?? null;
}