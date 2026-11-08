import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

dotenv.config({
  path: path.resolve(currentDir, "../../../.env"),
});


const requiredVariables = [
  "MYSQL_HOST",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
  "DB_ENCRYPTION_KEY",
];

if (
  !process.env.DB_ENCRYPTION_KEY ||
  !/^[0-9a-fA-F]{64}$/.test(process.env.DB_ENCRYPTION_KEY)
) {
  throw new Error(
    'DB_ENCRYPTION_KEY must be a valid 64-character hexadecimal key.'
  );
}

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing environment variable: ${variable}`);
  }
}

const requiredPostgresVariables = [
  'PGHOST',
  'PGUSER',
  'PGPASSWORD',
  'PGDATABASE',
];

for (const key of requiredPostgresVariables) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT || 3000),

  mysql: {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectionLimit: 10,
  },
  postgres: {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  },
  security: {
  dbEncryptionKey: process.env.DB_ENCRYPTION_KEY,
  },
};
