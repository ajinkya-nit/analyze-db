
import mysql from 'mysql2/promise';

import {
  decryptCredential,
} from '../utils/credential-encryption.js';

import * as projectRepository from '../repositories/project.repository.js';
import * as connectionRepository from '../repositories/database-connection.repository.js';
import * as schemaMetadataRepository from '../repositories/schema-metadata.repository.js';

import {
  discoverSchemaObjects,
  discoverTableColumns,
  discoverPrimaryKeys,
  discoverForeignKeys,
  discoverTableIndexes,
} from '../database/adapters/mysql-schema.adapter.js';

import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';

/**
 * Discover and persist the complete schema for a saved MySQL connection.
 */
export async function discoverAndSaveSchema(
  projectId,
  userId,
  connectionId
) {
  // 1. Verify project ownership.
  const project = await projectRepository.findProjectById(
    projectId,
    userId
  );

  if (!project) {
    throw new ApiError(404, 'Project not found.');
  }

  // 2. Retrieve the selected connection.
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
      'Schema discovery for this database engine is not supported yet.'
    );
  }

  // 3. Retrieve encrypted credentials.
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
    // 4. Decrypt the password inside the backend.
    password = decryptCredential(credential.password_encrypted);

    // 5. Connect to the customer's MySQL database.
    externalConnection = await mysql.createConnection({
      host: connection.host,
      port: Number(connection.port),
      user: connection.username,
      password,
      database: connection.database_name,
      connectTimeout: 5000,
      multipleStatements: false,
    });

    // 6. Discover tables and views.
    const schemaObjects = await discoverSchemaObjects(
      externalConnection,
      connection.database_name
    );

    const discoveredMetadata = [];

    // 7. Discover metadata for each object.
    for (const object of schemaObjects) {
      const columns = await discoverTableColumns(
        externalConnection,
        connection.database_name,
        object.objectName
      );

      let primaryKeys = [];
      let foreignKeys = [];
      let indexes = [];

      // Views do not have table indexes or declared table constraints.
      if (object.objectType === 'table') {
        primaryKeys = await discoverPrimaryKeys(
          externalConnection,
          connection.database_name,
          object.objectName
        );

        foreignKeys = await discoverForeignKeys(
          externalConnection,
          connection.database_name,
          object.objectName
        );

        indexes = await discoverTableIndexes(
          externalConnection,
          connection.database_name,
          object.objectName
        );
      }

      discoveredMetadata.push({
        schema_name: object.schemaName,
        object_name: object.objectName,
        object_type: object.objectType,
        metadata: {
          engine: 'mysql',
          storageEngine: object.engine,
          columns,
          primaryKeys,
          foreignKeys,
          indexes,
        },
      });
    }

    // 8. Save only after discovery of every object succeeds.
    const savedCount =
      await schemaMetadataRepository.replaceSchemaMetadata(
        connectionId,
        discoveredMetadata
      );

    logger.info(
      {
        connectionId,
        objectCount: savedCount,
        requestOperation: 'schema_discovery',
      },
      'Database schema discovered and saved'
    );

    return {
      connectionId,
      databaseName: connection.database_name,
      objectCount: savedCount,
      objects: discoveredMetadata.map((object) => ({
        schemaName: object.schema_name,
        objectName: object.object_name,
        objectType: object.object_type,
      })),
    };
  } catch (error) {
    logger.error(
      {
        connectionId,
        errorCode: error.code || 'UNKNOWN',
        requestOperation: 'schema_discovery',
      },
      'Database schema discovery failed'
    );

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      502,
      'Schema discovery failed. Check the database connection and permissions.'
    );
  } finally {
    if (externalConnection) {
      try {
        await externalConnection.end();
      } catch {
        logger.warn(
          { connectionId },
          'Unable to close external database connection cleanly'
        );
      }
    }

    password = undefined;
  }
}

/**
 * Retrieve previously discovered metadata.
 */
export async function getSavedSchemaMetadata(
  projectId,
  userId,
  connectionId
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

  return schemaMetadataRepository.findSchemaMetadataByConnectionId(
    connectionId
  );
}
