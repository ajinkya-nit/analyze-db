
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
