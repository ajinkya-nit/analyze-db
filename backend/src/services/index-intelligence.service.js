
import * as projectRepository from '../repositories/project.repository.js';
import * as connectionRepository from '../repositories/database-connection.repository.js';
import * as schemaMetadataRepository from '../repositories/schema-metadata.repository.js';

import { analyzeSchemaIndexes } from './index-analysis.service.js';

import ApiError from '../utils/ApiError.js';

/**
 * Analyze indexes for an authorized database connection.
 */
export async function getIndexIntelligence(
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

  const metadata =
    await schemaMetadataRepository.findSchemaMetadataByConnectionId(
      connectionId
    );

  if (metadata.length === 0) {
    throw new ApiError(
      404,
      'No schema metadata found. Discover the database schema first.'
    );
  }

  return analyzeSchemaIndexes(metadata);
}
