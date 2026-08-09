-- Luenio Agency CRM — Migration 001
-- Target: Neon Serverless Postgres
-- Versioned schema for clients, leads (pipeline), projects, invoices, metrics, users

BEGIN;

-- gen_random_uuid() is available on Neon (Postgres 13+). pgcrypto is optional.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE lead_stage AS ENUM (
    'nuevo',
    'contactado',
    'propuesta',
    'negociacion',
    'ganado',
    'perdido'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('activo', 'pausado', 'completado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('borrador', 'enviada', 'pagada', 'vencida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE client_status AS ENUM ('activo', 'prospecto', 'inactivo', 'churned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'agent', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── users ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  role          user_role NOT NULL DEFAULT 'agent',
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ── clients ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  company       text NOT NULL,
  email         text NOT NULL,
  phone         text,
  status        client_status NOT NULL DEFAULT 'prospecto',
  avatar_url    text,
  tags          text[] NOT NULL DEFAULT '{}',
  owner_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients (owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients (status);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients (company);
CREATE INDEX IF NOT EXISTS idx_clients_tags ON clients USING gin (tags);

-- ── leads (pipeline / kanban) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  client_id           uuid REFERENCES clients (id) ON DELETE SET NULL,
  stage               lead_stage NOT NULL DEFAULT 'nuevo',
  value               numeric(14, 2) NOT NULL DEFAULT 0,
  probability         integer NOT NULL DEFAULT 10
                        CHECK (probability >= 0 AND probability <= 100),
  expected_close_date date,
  position            double precision NOT NULL DEFAULT 0,
  owner_id            uuid REFERENCES users (id) ON DELETE SET NULL,
  notes               text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads (stage);
CREATE INDEX IF NOT EXISTS idx_leads_client ON leads (client_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads (owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage_position ON leads (stage, position);
CREATE INDEX IF NOT EXISTS idx_leads_expected_close ON leads (expected_close_date);

-- ── projects ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  name              text NOT NULL,
  status            project_status NOT NULL DEFAULT 'activo',
  start_date        date,
  end_date          date,
  budget            numeric(14, 2) NOT NULL DEFAULT 0,
  progress_percent  integer NOT NULL DEFAULT 0
                      CHECK (progress_percent >= 0 AND progress_percent <= 100),
  owner_id          uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects (client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner_id);

-- ── invoices ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
  project_id    uuid REFERENCES projects (id) ON DELETE SET NULL,
  number        text NOT NULL UNIQUE,
  amount        numeric(14, 2) NOT NULL CHECK (amount >= 0),
  currency      char(3) NOT NULL DEFAULT 'USD',
  status        invoice_status NOT NULL DEFAULT 'borrador',
  issue_date    date NOT NULL DEFAULT CURRENT_DATE,
  due_date      date NOT NULL,
  paid_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices (project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices (due_date);

-- ── metrics_snapshots (MRR / financieras) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month                 date NOT NULL UNIQUE,
  mrr                   numeric(14, 2) NOT NULL DEFAULT 0,
  new_mrr               numeric(14, 2) NOT NULL DEFAULT 0,
  churned_mrr           numeric(14, 2) NOT NULL DEFAULT 0,
  active_clients_count  integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_month ON metrics_snapshots (month DESC);

-- ── updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_leads_updated ON leads;
CREATE TRIGGER trg_leads_updated
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated ON invoices;
CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

COMMIT;
