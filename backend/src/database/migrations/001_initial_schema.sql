-- Initial Database Schema

--USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--PROJECTS
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

--DATABASE CONNECTIONS
CREATE TABLE database_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    engine VARCHAR(20) NOT NULL
        CHECK (engine IN ('mysql', 'postgresql')),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
    database_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    connection_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (connection_status IN ('pending', 'connected', 'failed')),
    last_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_database_connections_project_id
    ON database_connections(project_id);

--SCHEMA METADATA
CREATE TABLE schema_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL
        REFERENCES database_connections(id) ON DELETE CASCADE,
    schema_name VARCHAR(255) NOT NULL,
    object_name VARCHAR(255) NOT NULL,
    object_type VARCHAR(30) NOT NULL
        CHECK (object_type IN ('table', 'view')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (connection_id, schema_name, object_name, object_type)
);

CREATE INDEX idx_schema_metadata_connection_id
    ON schema_metadata(connection_id);