import { betterAuth } from 'better-auth';
import { PostgresDialect } from 'kysely';

import postgresPool from '../database/postgres.connection.js';
import './env.js';

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is required.');
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL is required.');
}

export const auth = betterAuth({
  appName: 'AnalyzeDB',
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    'http://localhost:5173',
  ],
  database: {
    dialect: new PostgresDialect({
      pool: postgresPool,
    }),
    type: 'postgres',
    schemaName: 'analyzedb_auth',
  },
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
});