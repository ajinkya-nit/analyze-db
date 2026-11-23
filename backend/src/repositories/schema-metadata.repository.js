
import postgresPool from '../database/postgres.connection.js';

/**
 * Replace all discovered schema metadata for a connection.
 * The replacement is atomic: existing metadata is retained if
 * any part of the operation fails.
 *
 * @param {string} connectionId
 * @param {object[]} objects
 */
export async function replaceSchemaMetadata(connectionId, objects) {
  const client = await postgresPool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM schema_metadata
       WHERE connection_id = $1`,
      [connectionId]
    );

    if (objects.length > 0) {
      await client.query(
        `INSERT INTO schema_metadata (
           connection_id,
           schema_name,
           object_name,
           object_type,
           metadata,
           last_refreshed_at,
           updated_at
         )
         SELECT
           $1,
           item.schema_name,
           item.object_name,
           item.object_type,
           item.metadata,
           NOW(),
           NOW()
         FROM jsonb_to_recordset($2::jsonb) AS item(
           schema_name TEXT,
           object_name TEXT,
           object_type TEXT,
           metadata JSONB
         )`,
        [connectionId, JSON.stringify(objects)]
      );
    }

    await client.query('COMMIT');

    return objects.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Retrieve all discovered metadata for a connection.
 *
 * @param {string} connectionId
 */
export async function findSchemaMetadataByConnectionId(connectionId) {
  const result = await postgresPool.query(
    `SELECT
       id,
       connection_id,
       schema_name,
       object_name,
       object_type,
       metadata,
       last_refreshed_at,
       created_at,
       updated_at
     FROM schema_metadata
     WHERE connection_id = $1
     ORDER BY schema_name, object_name`,
    [connectionId]
  );

  return result.rows;
}


/**
 * Save a schema snapshot and replace current metadata atomically.
 *
 * @param {string} connectionId
 * @param {object[]} objects
 */
export async function saveSchemaSnapshotAndReplaceMetadata(
  connectionId,
  objects
) {
  const client = await postgresPool.connect();

  try {
    await client.query('BEGIN');

    // Serialize snapshot numbering for this connection.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [connectionId]
    );

    const snapshotResult = await client.query(
      `SELECT COALESCE(MAX(snapshot_number), 0) + 1 AS next_number
       FROM schema_snapshots
       WHERE connection_id = $1`,
      [connectionId]
    );

    const snapshotNumber = Number(
      snapshotResult.rows[0].next_number
    );

    const snapshotInsert = await client.query(
      `INSERT INTO schema_snapshots (
         connection_id,
         snapshot_number,
         schema_metadata
       )
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, snapshot_number, created_at`,
      [
        connectionId,
        snapshotNumber,
        JSON.stringify(objects),
      ]
    );

    await client.query(
      `DELETE FROM schema_metadata
       WHERE connection_id = $1`,
      [connectionId]
    );

    if (objects.length > 0) {
      await client.query(
        `INSERT INTO schema_metadata (
           connection_id,
           schema_name,
           object_name,
           object_type,
           metadata,
           last_refreshed_at,
           updated_at
         )
         SELECT
           $1,
           item.schema_name,
           item.object_name,
           item.object_type,
           item.metadata,
           NOW(),
           NOW()
         FROM jsonb_to_recordset($2::jsonb) AS item(
           schema_name TEXT,
           object_name TEXT,
           object_type TEXT,
           metadata JSONB
         )`,
        [connectionId, JSON.stringify(objects)]
      );
    }

    await client.query('COMMIT');

    return {
      ...snapshotInsert.rows[0],
      objectCount: objects.length,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original transaction error.
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Retrieve snapshot history for a connection.
 */
export async function findSchemaSnapshotsByConnectionId(
  connectionId
) {
  const result = await postgresPool.query(
    `SELECT
       id,
       connection_id,
       snapshot_number,
       jsonb_array_length(schema_metadata) AS object_count,
       created_at
     FROM schema_snapshots
     WHERE connection_id = $1
     ORDER BY snapshot_number DESC`,
    [connectionId]
  );

  return result.rows;
}

/**
 * Retrieve one complete snapshot.
 */
export async function findSchemaSnapshotById(
  connectionId,
  snapshotId
) {
  const result = await postgresPool.query(
    `SELECT
       id,
       connection_id,
       snapshot_number,
       schema_metadata,
       created_at
     FROM schema_snapshots
     WHERE connection_id = $1
       AND id = $2`,
    [connectionId, snapshotId]
  );

  return result.rows[0] ?? null;
}
