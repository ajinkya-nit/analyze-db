
import * as projectRepository from '../repositories/project.repository.js';
import * as connectionRepository from '../repositories/database-connection.repository.js';
import * as schemaMetadataRepository from '../repositories/schema-metadata.repository.js';

import {
  buildSchemaRelationshipGraph,
} from './schema-relationship.service.js';

import {
  buildSchemaSummary,
} from './schema-summary.service.js';

import ApiError from '../utils/ApiError.js';

/**
 * Retrieve schema metadata after verifying project ownership
 * and connection membership.
 */
async function getAuthorizedSchema(
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

/**
 * Get the relationship graph.
 */
export async function getSchemaRelationships(
  projectId,
  userId,
  connectionId
) {
  const metadata = await getAuthorizedSchema(
    projectId,
    userId,
    connectionId
  );

  return buildSchemaRelationshipGraph(metadata);
}

/**
 * Get the structural schema summary.
 */
export async function getSchemaSummary(
  projectId,
  userId,
  connectionId
) {
  const metadata = await getAuthorizedSchema(
    projectId,
    userId,
    connectionId
  );

  return buildSchemaSummary(metadata);
}

/**
 * Get metadata for one table or view.
 */
export async function getSchemaObject(
  projectId,
  userId,
  connectionId,
  schemaName,
  objectName
) {
  const metadata = await getAuthorizedSchema(
    projectId,
    userId,
    connectionId
  );

  const object = metadata.find(
    (item) =>
      item.schema_name === schemaName &&
      item.object_name === objectName
  );

  if (!object) {
    throw new ApiError(404, 'Schema object not found.');
  }

  return object;
}
