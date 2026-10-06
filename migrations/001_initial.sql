CREATE TABLE IF NOT EXISTS records (
 kind text NOT NULL, id text NOT NULL, owner text NOT NULL,
 body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(kind,id)
);
CREATE INDEX IF NOT EXISTS records_owner ON records(owner,kind);
CREATE TABLE IF NOT EXISTS challenges (
 nonce text PRIMARY KEY, address text NOT NULL, message text NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 hash text PRIMARY KEY, owner text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys (
 id text PRIMARY KEY, owner text NOT NULL, name text NOT NULL,
 hash text NOT NULL UNIQUE, prefix text NOT NULL, created_at timestamptz DEFAULT now(),
 revoked boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS rate_limits (
 key text NOT NULL, bucket bigint NOT NULL, count integer NOT NULL,
 PRIMARY KEY(key,bucket)
);
CREATE TABLE IF NOT EXISTS observations (
 id bigserial PRIMARY KEY, observed_at timestamptz NOT NULL,
 provider text NOT NULL, offer_id text NOT NULL, hardware text NOT NULL,
 region text NOT NULL, gpu_count integer NOT NULL CHECK(gpu_count > 0),
 price numeric NOT NULL CHECK(price > 0), availability text NOT NULL,
 nodes integer, UNIQUE(observed_at,offer_id)
);
CREATE INDEX IF NOT EXISTS observations_hardware_time ON observations(hardware,observed_at);
CREATE TABLE IF NOT EXISTS events (
 id text PRIMARY KEY, owner text NOT NULL, type text NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
