
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
  discoverViewDetails,
  discoverViewDependencies,
} from '../database/adapters/mysql-schema.adapter.js';

import {
  discoverColumnStatistics,
} from './column-statistics-discovery.service.js';

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
      'Schema discovery for this database engine is not supported yet.'
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
    password = decryptCredential(credential.password_encrypted);

    externalConnection = await mysql.createConnection({
      host: connection.host,
      port: Number(connection.port),
      user: connection.username,
      password,
      database: connection.database_name,
      connectTimeout: 5000,
      multipleStatements: false,
    });

    const schemaObjects = await discoverSchemaObjects(
      externalConnection,
      connection.database_name
    );

    // Used to identify dependencies that belong to this discovered schema.
    const objectTypeMap = new Map(
      schemaObjects.map((object) => [
        `${object.schemaName}.${object.objectName}`,
        object.objectType,
      ])
    );

    const discoveredMetadata = [];

    for (const object of schemaObjects) {
      const columns = await discoverTableColumns(
        externalConnection,
        connection.database_name,
        object.objectName
      );

      let primaryKeys = [];
      let foreignKeys = [];
      let indexes = [];
      let viewDetails = null;
      let viewDependencies = [];

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

      const columnStatistics = object.objectType === 'table'
        ? await discoverColumnStatistics(
            externalConnection,
            connection.database_name,
            object.objectName,
            {
              columns,
              indexes,
              estimatedRowCount: object.estimatedRows,
            }
          )
        : [];

      if (object.objectType === 'view') {
        viewDetails = await discoverViewDetails(
          externalConnection,
          connection.database_name,
          object.objectName
        );

        const dependencies = await discoverViewDependencies(
          externalConnection,
          connection.database_name,
          object.objectName
        );

        viewDependencies = dependencies.map((dependency) => ({
          ...dependency,
          referencedObjectType:
            objectTypeMap.get(
              `${dependency.referencedSchema}.${dependency.referencedObject}`
            ) ?? null,
        }));
      }

      const metadata = {
        engine: 'mysql',
        storageEngine: object.engine,
        columns,
        primaryKeys,
        foreignKeys,
        indexes,
        columnStatistics,

        tableDetails: object.objectType === 'table'
          ? {
              comment: object.tableComment,
              estimatedRows: object.estimatedRows,
              dataLengthBytes: object.dataLengthBytes,
              indexLengthBytes: object.indexLengthBytes,
              dataFreeBytes: object.dataFreeBytes,
              autoIncrement: object.autoIncrement,
              createdAt: object.createdAt,
              updatedAt: object.updatedAt,
              collation: object.collation,
              createOptions: object.createOptions,
            }
          : null,

        viewDetails,
        viewDependencies,
      };

      discoveredMetadata.push({
        schema_name: object.schemaName,
        object_name: object.objectName,
        object_type: object.objectType,
        metadata,
      });
    }

    // Save only after every discovery operation succeeds.
    const snapshot =
      await schemaMetadataRepository.saveSchemaSnapshotAndReplaceMetadata(
        connectionId,
        discoveredMetadata
      );

    logger.info(
      {
        connectionId,
        objectCount: snapshot.objectCount,
        requestOperation: 'schema_discovery',
      },
      'Database schema discovered and saved'
    );

    return {
      connectionId,
      databaseName: connection.database_name,
      snapshotId: snapshot.id,
      snapshotNumber: Number(snapshot.snapshot_number),
      objectCount: snapshot.objectCount,
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
