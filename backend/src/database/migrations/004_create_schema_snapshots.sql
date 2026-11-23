
-- Create immutable schema snapshots for historical comparison.

CREATE TABLE IF NOT EXISTS schema_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    connection_id UUID NOT NULL
        REFERENCES database_connections(id) ON DELETE CASCADE,

    snapshot_number BIGINT NOT NULL,

    schema_metadata JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_schema_snapshots_connection_number
        UNIQUE (connection_id, snapshot_number)
);

CREATE INDEX IF NOT EXISTS idx_schema_snapshots_connection_id
    ON schema_snapshots(connection_id, snapshot_number DESC);
