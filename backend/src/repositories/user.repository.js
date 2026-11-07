import postgresPool from '../database/postgres.connection.js';

export async function createUser({ email, fullName }) {
  const result = await postgresPool.query(
    `INSERT INTO users (email, full_name)
     VALUES ($1, $2)
     RETURNING *`,
    [email, fullName ?? null]
  );

  return result.rows[0];
}

export async function findUserById(userId) {
  const result = await postgresPool.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  return result.rows[0] ?? null;
}


export async function findUserByEmail(email) {
  const result = await postgresPool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  return result.rows[0] ?? null;
}

export async function updateUser(userId, { email, fullName }) {
  const result = await postgresPool.query(
    `UPDATE users
     SET email = COALESCE($2, email),
         full_name = COALESCE($3, full_name),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, email ?? null, fullName ?? null]
  );

  return result.rows[0] ?? null;
}

export async function deleteUser(userId) {
  const result = await postgresPool.query(
    'DELETE FROM users WHERE id = $1 RETURNING id',
    [userId]
  );

  return result.rowCount > 0;
}