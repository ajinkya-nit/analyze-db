import mysql from 'mysql2/promise';

import * as projectRepository from '../repositories/project.repository.js';

import * as connectionRepository from '../repositories/database-connection.repository.js';
import * as schemaMetadataRepository from '../repositories/schema-metadata.repository.js';

import {
  analyzeAdvancedQuery,
} from './advanced-query-intelligence.service.js';

import {
  decryptCredential,
} from '../utils/credential-encryption.js';

import {
  explainSelectQuery,
} from '../database/adapters/mysql-query-plan.adapter.js';

import {
  analyzeQueryExecutionPlan,
} from './query-plan-analysis.service.js';

import ApiError from '../utils/ApiError.js';

import logger from '../config/logger.js';

/**
 * Analyze a SELECT query using the saved MySQL connection.
 */
export async function analyzeQueryPerformance(
  projectId,
  userId,
  connectionId,
  sql
) {
  const project = await projectRepository.findProjectById(
    projectId,
    userId
  );

  if (!project) {
    throw new ApiError(404, 'Project not found.');
  }

  const connection =
    await connectionRepository.findDatabaseConnectionById(
      connectionId,
      projectId
    );

  if (!connection) {
    throw new ApiError(404, 'Database connection not found.');
  }

  if (connection.engine !== 'mysql') {
    throw new ApiError(
      400,
      'Query performance analysis for this database engine is not supported yet.'
    );
  }

  const credential =
    await connectionRepository.findDatabaseConnectionCredentialsById(
      connectionId,
      projectId
    );

  if (!credential?.password_encrypted) {
    throw new ApiError(
      500,
      'Saved database credentials are unavailable.'
    );
  }

  let password;
  let externalConnection;

  try {
    password = decryptCredential(
      credential.password_encrypted
    );

    externalConnection = await mysql.createConnection({
      host: connection.host,
      port: Number(connection.port),
      user: connection.username,
      password,
      database: connection.database_name,
      connectTimeout: 5_000,
      multipleStatements: false,
      charset: 'utf8mb4',
    });

    const plan = await explainSelectQuery(
      externalConnection,
      sql
    );

    const analysis = analyzeQueryExecutionPlan(plan);

    const schemaMetadata =
      await schemaMetadataRepository.findSchemaMetadataByConnectionId(
        connectionId
      );

    const advancedAnalysis = analyzeAdvancedQuery(
      sql,
      schemaMetadata
    );

    logger.info(
      {
        connectionId,
        tableCount: analysis.tableCount,
        findingCount: analysis.findingCount,
        requestOperation: 'query_performance_analysis',
      },
      'Query execution plan analyzed'
    );

    return {
      databaseEngine: 'mysql',
      databaseName: connection.database_name,
      analysisMethod: 'EXPLAIN FORMAT=JSON',
      queryExecuted: false,
      executionPlan: analysis,
      advancedIntelligence: advancedAnalysis,
    };
  } catch (error) {
    logger.warn(
      {
        connectionId,
        errorCode: error.code || 'UNKNOWN',
        requestOperation: 'query_performance_analysis',
      },
      'Query performance analysis failed'
    );

    if (error instanceof ApiError) {
      throw error;
    }

    if (
      error.code === 'ER_PARSE_ERROR' ||
      error.code === 'ER_BAD_FIELD_ERROR' ||
      error.code === 'ER_NO_SUCH_TABLE' ||
      error.code === 'ER_TABLEACCESS_DENIED_ERROR' ||
      error.code === 'ER_COLUMNACCESS_DENIED_ERROR'
    ) {
      throw new ApiError(
        422,
        'MySQL could not generate an execution plan. Check the SQL syntax, table names, column names, and database permissions.'
      );
    }

    if (
      error.code === 'ETIMEDOUT' ||
      error.code === 'PROTOCOL_SEQUENCE_TIMEOUT' ||
      error.code === 'PROTOCOL_CONNECTION_LOST'
    ) {
      throw new ApiError(
        504,
        'Query plan analysis timed out or the database connection was interrupted.'
      );
    }

    throw new ApiError(
      502,
      'Unable to analyze the query. Check the saved database connection and database availability.'
    );
  } finally {
    if (externalConnection) {
      try {
        await externalConnection.end();
      } catch {
        logger.warn(
          { connectionId },
          'Unable to close query analysis connection cleanly'
        );
      }
    }

    password = undefined;
  }
}
