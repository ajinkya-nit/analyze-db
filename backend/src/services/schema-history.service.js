
import * as projectRepository from '../repositories/project.repository.js';
import * as connectionRepository from '../repositories/database-connection.repository.js';
import * as schemaMetadataRepository from '../repositories/schema-metadata.repository.js';

import {
  detectSchemaChanges,
} from './schema-change-detection.service.js';

import ApiError from '../utils/ApiError.js';

async function verifyConnectionOwnership(
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
}

/**
 * List available schema snapshots.
 */
export async function getSchemaSnapshotHistory(
  projectId,
  userId,
  connectionId
) {
  await verifyConnectionOwnership(projectId, userId, connectionId);

  return schemaMetadataRepository.findSchemaSnapshotsByConnectionId(
    connectionId
  );
}

/**
 * Compare two snapshots.
 * If IDs are omitted, compare the latest two snapshots.
 */
export async function getSchemaChangeReport(
  projectId,
  userId,
  connectionId,
  fromSnapshotId,
  toSnapshotId
) {
  await verifyConnectionOwnership(projectId, userId, connectionId);

  let previousSnapshot;
  let currentSnapshot;

  if (fromSnapshotId || toSnapshotId) {
    if (!fromSnapshotId || !toSnapshotId) {
      throw new ApiError(
        400,
        'Both fromSnapshotId and toSnapshotId are required.'
      );
    }

    [previousSnapshot, currentSnapshot] = await Promise.all([
      schemaMetadataRepository.findSchemaSnapshotById(
        connectionId,
        fromSnapshotId
      ),
      schemaMetadataRepository.findSchemaSnapshotById(
        connectionId,
        toSnapshotId
      ),
    ]);

    if (!previousSnapshot || !currentSnapshot) {
      throw new ApiError(404, 'One or both schema snapshots were not found.');
    }
  } else {
    const snapshots =
      await schemaMetadataRepository.findSchemaSnapshotsByConnectionId(
        connectionId
      );

    if (snapshots.length < 2) {
      throw new ApiError(
        409,
        'At least two schema snapshots are required for comparison.'
      );
    }

    [currentSnapshot, previousSnapshot] = await Promise.all([
      schemaMetadataRepository.findSchemaSnapshotById(
        connectionId,
        snapshots[0].id
      ),
      schemaMetadataRepository.findSchemaSnapshotById(
        connectionId,
        snapshots[1].id
      ),
    ]);
  }

  if (
    Number(previousSnapshot.snapshot_number) >=
    Number(currentSnapshot.snapshot_number)
  ) {
    throw new ApiError(
      400,
      'The current snapshot must be newer than the previous snapshot.'
    );
  }

  return detectSchemaChanges(
    previousSnapshot,
    currentSnapshot
  );
}
