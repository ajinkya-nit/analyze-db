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