
-- =====================================================
-- 1. CREATE BETTER AUTH SCHEMA
-- =====================================================

CREATE SCHEMA IF NOT EXISTS analyzedb_auth;

-- =====================================================
-- 2. BETTER AUTH USER TABLE
-- =====================================================

CREATE TABLE analyzedb_auth.user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL,
    image TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. BETTER AUTH SESSION TABLE
-- =====================================================

CREATE TABLE analyzedb_auth.session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "expiresAt" TIMESTAMPTZ NOT NULL,
    token TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL REFERENCES analyzedb_auth.user(id) ON DELETE CASCADE
);

-- =====================================================
-- 4. BETTER AUTH ACCOUNT TABLE
-- =====================================================

CREATE TABLE analyzedb_auth.account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL REFERENCES analyzedb_auth.user(id) ON DELETE CASCADE,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ,
    "refreshTokenExpiresAt" TIMESTAMPTZ,
    scope TEXT,
    password TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL
);

-- =====================================================
-- 5. BETTER AUTH VERIFICATION TABLE
-- =====================================================

CREATE TABLE analyzedb_auth.verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. CREATE INDEXES
-- =====================================================

CREATE INDEX session_userId_idx ON analyzedb_auth.session("userId");

CREATE INDEX account_userId_idx ON analyzedb_auth.account("userId");

CREATE INDEX verification_identifier_idx ON analyzedb_auth.verification(identifier);

-- =====================================================
-- 7. CONNECT ANALYZEDB PROJECTS TO BETTER AUTH USERS
-- =====================================================

ALTER TABLE public.projects
DROP CONSTRAINT projects_user_id_fkey;

ALTER TABLE public.projects
ADD CONSTRAINT projects_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES analyzedb_auth.user(id)
ON DELETE CASCADE;

-- =====================================================
-- 8. REMOVE OLD USER TABLE
-- =====================================================

DROP TABLE public.users;
