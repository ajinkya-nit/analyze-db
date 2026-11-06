import pg from 'pg';
import { env } from '../config/env.js';
import logger from '../config/logger.js';
import { readFileSync } from 'node:fs';

const { Pool } = pg;

const postgresPool = new Pool({
  host: env.postgres.host,
  port: env.postgres.port,
  user: env.postgres.user,
  password: env.postgres.password,
  database: env.postgres.database,

  //encrypted TLS and validate the server certificate
    ssl: {
    ca: readFileSync(
        new URL('../../certs/prod-ca-2021.crt', import.meta.url),
        'utf8'
    ),
    rejectUnauthorized: true,
    },

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

postgresPool.on('error', (error) => {
  logger.error(
    { errorCode: error.code || 'UNKNOWN' },
    'Unexpected error from idle PostgreSQL client'
  );
});

export async function testPostgresConnection() {
  const result = await postgresPool.query(
    'SELECT NOW() AS current_time, current_database() AS database'
  );

  return {
    connected: true,
    database: result.rows[0].database,
    currentTime: result.rows[0].current_time,
  };
}

export async function closePostgresConnection() {
  await postgresPool.end();
}

export default postgresPool;