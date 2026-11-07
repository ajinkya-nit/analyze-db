import postgresPool from '../database/postgres.connection.js';

export async function createProject({
  userId,
  name,
  description,
}) {
  const result = await postgresPool.query(
    `INSERT INTO projects (user_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, name, description ?? null]
  );

  return result.rows[0];
}

export async function findProjectById(projectId, userId) {
  const result = await postgresPool.query(
    `SELECT *
     FROM projects
     WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );

  return result.rows[0] ?? null;
}

export async function findProjectsByUserId(userId) {
  const result = await postgresPool.query(
    `SELECT *
     FROM projects
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

export async function updateProject(
  projectId,
  userId,
  { name, description }
) {
  const result = await postgresPool.query(
    `UPDATE projects
     SET name = COALESCE($3, name),
         description = COALESCE($4, description),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [projectId, userId, name ?? null, description ?? null]
  );

  return result.rows[0] ?? null;
}

export async function deleteProject(projectId, userId) {
  const result = await postgresPool.query(
    `DELETE FROM projects
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [projectId, userId]
  );

  return result.rowCount > 0;
}