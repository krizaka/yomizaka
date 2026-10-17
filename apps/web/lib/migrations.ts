/**
 * The schema, as ordered migrations applied once each (lib/db.ts `migrate`, at server start, under an advisory lock).
 * Kept in code rather than in .sql files so the standalone server carries them. A migration is never edited once
 * deployed: a change is a new entry.
 */
export interface Migration {
  version: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: "0001_initial",
    sql: `
CREATE TABLE accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  role          text NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  status        text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  locale        text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'fr')),
  password_hash text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz
);

-- A web session: the cookie holds a random token, the table its keyed hash (a leaked table opens nothing).
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  ip           text,
  user_agent   text
);
CREATE INDEX sessions_account ON sessions(account_id);

-- A document and its file. The MVP keeps the file here (bytea, ≤ 10 MB): no storage service to pay for or secure yet.
-- text is the PDF's text layer (or the text file), read at upload — the input of Orazaka's compliance Studio and of search.
CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title       text NOT NULL,
  filename    text NOT NULL,
  mime_type   text NOT NULL CHECK (mime_type IN ('application/pdf', 'text/plain')),
  kind        text NOT NULL DEFAULT 'other' CHECK (kind IN ('lease', 'contract', 'invoice', 'other')),
  size_bytes  integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256      text NOT NULL,
  pages       integer,
  content     bytea NOT NULL,
  text        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  search      tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(text, '')), 'B')
              ) STORED,
  UNIQUE (owner_id, sha256)
);
CREATE INDEX documents_owner ON documents(owner_id, created_at DESC);
CREATE INDEX documents_search ON documents USING gin(search);

-- An analysis is an Orazaka run: its id (the trace), its status as Orazaka last said it, the report Orazaka returned.
CREATE TABLE analyses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  studio            text NOT NULL CHECK (studio IN ('compliance-check', 'document-authenticity')),
  status            text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
  run_id            text,
  blueprint_version text,
  inputs            jsonb NOT NULL DEFAULT '{}',
  report            jsonb,
  error             text,
  search_text       text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz
);
CREATE INDEX analyses_document ON analyses(document_id, created_at DESC);
CREATE INDEX analyses_search ON analyses USING gin(to_tsvector('simple', search_text));

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid,
  actor_label text NOT NULL,
  action      text NOT NULL,
  target_id   text,
  detail      jsonb NOT NULL DEFAULT '{}',
  ip          text
);
CREATE INDEX audit_log_at ON audit_log(at DESC);
`,
  },
  {
    version: "0002_showcase",
    sql: `
-- A document an administrator has declared a sample (non-personal): the only kind a public showcase may show.
ALTER TABLE documents ADD COLUMN sample boolean NOT NULL DEFAULT false;
-- The analysis the public page shows (at most one at a time: promoting another replaces it). Set by an administrator only.
ALTER TABLE analyses ADD COLUMN showcase boolean NOT NULL DEFAULT false;
CREATE INDEX analyses_showcase ON analyses(finished_at DESC) WHERE showcase;
`,
  },
  {
    version: "0003_report_grants",
    sql: `
-- Verifying a signed report is for the people the report's owner gave access to (ADR-0002). A grant names an e-mail:
-- a member of that address has access at once, and an address with no account yet is an invitation honoured the day the
-- account exists (sign-up is closed on dev, so the row waits). Revoked or past its expiry, a grant opens nothing.
CREATE TABLE report_grants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id   uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  granted_by    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  grantee_email text NOT NULL CHECK (grantee_email = lower(grantee_email)),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  revoked_at    timestamptz
);
CREATE UNIQUE INDEX report_grants_live ON report_grants(analysis_id, grantee_email) WHERE revoked_at IS NULL;
CREATE INDEX report_grants_email ON report_grants(grantee_email);

-- "Request access": a signed-in member asks the owner for a report they cannot verify; the owner sees it beside the grants.
CREATE TABLE report_access_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id     uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  requester_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  requester_email text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  handled_at      timestamptz
);
CREATE UNIQUE INDEX report_access_requests_open ON report_access_requests(analysis_id, requester_id) WHERE handled_at IS NULL;
`,
  },
  {
    version: "0004_perspective",
    sql: `
-- Which side of the lease the person is on (chosen at onboarding, changeable in settings): drives the default checks and the wording.
ALTER TABLE accounts ADD COLUMN perspective text CHECK (perspective IN ('tenant', 'landlord'));
`,
  },
  {
    version: "0005_audiences",
    sql: `
-- « Pour qui ? » grows past the two sides of a lease: freelancers and small businesses (offered as « soon » until their rules exist).
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_perspective_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_perspective_check CHECK (perspective IN ('tenant', 'landlord', 'freelancer', 'business'));
`,
  },
  {
    version: "0006_flows",
    sql: `
-- Flows are data, administered on admin.yomizaka.com (ADR-0003). A published version never changes.
CREATE TABLE flows (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9-]{1,60}$'),
  current_version_id uuid,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE flow_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id      uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  version      integer NOT NULL CHECK (version >= 1),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  definition   jsonb NOT NULL,
  created_by   uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (flow_id, version)
);
ALTER TABLE flows ADD CONSTRAINT flows_current_version FOREIGN KEY (current_version_id) REFERENCES flow_versions(id) ON DELETE SET NULL;
CREATE TABLE flow_environments (
  flow_id     uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('dev', 'prod')),
  enabled     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (flow_id, environment)
);
-- What a person agreed to (a flow may require it): granted, then maybe withdrawn.
CREATE TABLE consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key         text NOT NULL CHECK (key ~ '^[a-z0-9-]{1,40}$'),
  granted_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);
CREATE UNIQUE INDEX consents_live ON consents(account_id, key) WHERE revoked_at IS NULL;
-- The exact flow version that produced a check: publishing a new version never touches an old analysis.
ALTER TABLE analyses ADD COLUMN flow_version_id uuid REFERENCES flow_versions(id) ON DELETE SET NULL;
`,
  },
];
