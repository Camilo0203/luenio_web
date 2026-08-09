-- Luenio Agency CRM — Seed 001
-- Realistic agency data (last 6 months). No lorem ipsum.

BEGIN;

-- Idempotent re-seed for empty environments
TRUNCATE TABLE invoices, projects, leads, metrics_snapshots, clients, users RESTART IDENTITY CASCADE;

-- ── Team ───────────────────────────────────────────────────────────────────

INSERT INTO users (id, name, email, role, avatar_url) VALUES
  ('a1111111-1111-4111-8111-111111111111', 'Camilo Restrepo', 'meltrinox@gmail.com', 'owner', NULL),
  ('a2222222-2222-4222-8222-222222222222', 'Valentina Ortiz', 'valentina@luenio.co', 'admin', NULL),
  ('a3333333-3333-4333-8333-333333333333', 'Mateo Herrera', 'mateo@luenio.co', 'agent', NULL),
  ('a4444444-4444-4444-8444-444444444444', 'Sofía Rincón', 'sofia@luenio.co', 'agent', NULL);

-- ── Clients ────────────────────────────────────────────────────────────────

INSERT INTO clients (id, name, company, email, phone, status, tags, owner_id, created_at) VALUES
  ('b1111111-1111-4111-8111-111111111101', 'Laura Méndez', 'Nova Studio SAS', 'laura@novastudio.co', '+57 300 111 2233', 'activo', ARRAY['design','retainer'], 'a3333333-3333-4333-8333-333333333333', now() - interval '160 days'),
  ('b1111111-1111-4111-8111-111111111102', 'Andrés Quintero', 'LegalHub Colombia', 'andres@legalhub.co', '+57 310 445 6677', 'activo', ARRAY['legal','saas'], 'a2222222-2222-4222-8222-222222222222', now() - interval '140 days'),
  ('b1111111-1111-4111-8111-111111111103', 'Camila Duarte', 'Andes Coffee Roasters', 'camila@andescoffee.com', '+57 320 889 0011', 'activo', ARRAY['ecom','brand'], 'a4444444-4444-4444-8444-444444444444', now() - interval '120 days'),
  ('b1111111-1111-4111-8111-111111111104', 'Diego Farfán', 'Ruta Norte Mobility', 'diego@rutanorte.io', '+57 301 772 3344', 'prospecto', ARRAY['mobility','b2b'], 'a3333333-3333-4333-8333-333333333333', now() - interval '45 days'),
  ('b1111111-1111-4111-8111-111111111105', 'Isabella Torres', 'Finora Capital', 'isabella@finora.vc', '+57 315 220 9988', 'activo', ARRAY['fintech','enterprise'], 'a2222222-2222-4222-8222-222222222222', now() - interval '95 days'),
  ('b1111111-1111-4111-8111-111111111106', 'Julián Pardo', 'Basecamp Logistics', 'julian@basecamp.log', '+57 304 556 1122', 'inactivo', ARRAY['ops'], 'a4444444-4444-4444-8444-444444444444', now() - interval '180 days'),
  ('b1111111-1111-4111-8111-111111111107', 'Mariana Vélez', 'Pixel & Clay', 'mariana@pixelclay.studio', '+57 318 667 4433', 'prospecto', ARRAY['agency','creative'], 'a3333333-3333-4333-8333-333333333333', now() - interval '18 days'),
  ('b1111111-1111-4111-8111-111111111108', 'Ricardo Salas', 'Helix Health Labs', 'ricardo@helixhealth.co', '+57 300 909 7788', 'activo', ARRAY['health','product'], 'a2222222-2222-4222-8222-222222222222', now() - interval '70 days'),
  ('b1111111-1111-4111-8111-111111111109', 'Natalia Gómez', 'Copperline Interiors', 'natalia@copperline.co', '+57 311 234 5566', 'churned', ARRAY['interior'], 'a4444444-4444-4444-8444-444444444444', now() - interval '200 days'),
  ('b1111111-1111-4111-8111-111111111110', 'Felipe Castro', 'Orbit Education', 'felipe@orbit.education', '+57 312 888 3344', 'prospecto', ARRAY['edtech'], 'a3333333-3333-4333-8333-333333333333', now() - interval '12 days');

-- ── Leads / Pipeline ───────────────────────────────────────────────────────

INSERT INTO leads (id, name, client_id, stage, value, probability, expected_close_date, position, owner_id, notes, created_at) VALUES
  ('c1111111-1111-4111-8111-111111111201', 'Rediseño web Nova', 'b1111111-1111-4111-8111-111111111101', 'negociacion', 18500.00, 75, CURRENT_DATE + 12, 1, 'a3333333-3333-4333-8333-333333333333', 'Verbal yes; waiting on procurement.', now() - interval '34 days'),
  ('c1111111-1111-4111-8111-111111111202', 'Portal clientes LegalHub', 'b1111111-1111-4111-8111-111111111102', 'propuesta', 42000.00, 55, CURRENT_DATE + 28, 1, 'a2222222-2222-4222-8222-222222222222', 'Proposal v2 sent after security review.', now() - interval '21 days'),
  ('c1111111-1111-4111-8111-111111111203', 'Brand system Andes Coffee', 'b1111111-1111-4111-8111-111111111103', 'contactado', 9600.00, 40, CURRENT_DATE + 40, 1, 'a4444444-4444-4444-8444-444444444444', 'Follow-up after tasting event.', now() - interval '9 days'),
  ('c1111111-1111-4111-8111-111111111204', 'App flota Ruta Norte', 'b1111111-1111-4111-8111-111111111104', 'nuevo', 68000.00, 20, CURRENT_DATE + 60, 1, 'a3333333-3333-4333-8333-333333333333', 'Inbound from LinkedIn campaign.', now() - interval '3 days'),
  ('c1111111-1111-4111-8111-111111111205', 'Dashboard inversores Finora', 'b1111111-1111-4111-8111-111111111105', 'negociacion', 54000.00, 70, CURRENT_DATE + 8, 2, 'a2222222-2222-4222-8222-222222222222', 'Legal redlines in progress.', now() - interval '41 days'),
  ('c1111111-1111-4111-8111-111111111206', 'Site rebuild Pixel & Clay', 'b1111111-1111-4111-8111-111111111107', 'nuevo', 7200.00, 15, CURRENT_DATE + 45, 2, 'a3333333-3333-4333-8333-333333333333', 'Warm intro from Nova Studio.', now() - interval '2 days'),
  ('c1111111-1111-4111-8111-111111111207', 'Patient portal Helix', 'b1111111-1111-4111-8111-111111111108', 'propuesta', 31000.00, 50, CURRENT_DATE + 22, 2, 'a2222222-2222-4222-8222-222222222222', 'HIPAA checklist shared.', now() - interval '16 days'),
  ('c1111111-1111-4111-8111-111111111208', 'LMS Orbit Education', 'b1111111-1111-4111-8111-111111111110', 'contactado', 27500.00, 35, CURRENT_DATE + 35, 2, 'a4444444-4444-4444-8444-444444444444', 'Demo scheduled next week.', now() - interval '7 days'),
  ('c1111111-1111-4111-8111-111111111209', 'Retainer Basecamp Q2', 'b1111111-1111-4111-8111-111111111106', 'perdido', 12000.00, 0, CURRENT_DATE - 20, 1, 'a4444444-4444-4444-8444-444444444444', 'Budget freeze until H2.', now() - interval '55 days'),
  ('c1111111-1111-4111-8111-111111111210', 'E-commerce Copperline', 'b1111111-1111-4111-8111-111111111109', 'ganado', 14800.00, 100, CURRENT_DATE - 90, 1, 'a4444444-4444-4444-8444-444444444444', 'Closed; project completed.', now() - interval '120 days'),
  ('c1111111-1111-4111-8111-111111111211', 'Performance ads Nova', 'b1111111-1111-4111-8111-111111111101', 'nuevo', 4500.00, 25, CURRENT_DATE + 30, 3, 'a3333333-3333-4333-8333-333333333333', 'Upsell on paid media.', now() - interval '1 day'),
  ('c1111111-1111-4111-8111-111111111212', 'API integrations LegalHub', 'b1111111-1111-4111-8111-111111111102', 'contactado', 19000.00, 45, CURRENT_DATE + 50, 3, 'a2222222-2222-4222-8222-222222222222', 'Technical discovery done.', now() - interval '11 days');

-- ── Projects ───────────────────────────────────────────────────────────────

INSERT INTO projects (id, client_id, name, status, start_date, end_date, budget, progress_percent, owner_id, created_at) VALUES
  ('d1111111-1111-4111-8111-111111111301', 'b1111111-1111-4111-8111-111111111101', 'Nova Studio — Design system', 'activo', CURRENT_DATE - 90, CURRENT_DATE + 30, 22000.00, 68, 'a3333333-3333-4333-8333-333333333333', now() - interval '90 days'),
  ('d1111111-1111-4111-8111-111111111302', 'b1111111-1111-4111-8111-111111111102', 'LegalHub — Client portal MVP', 'activo', CURRENT_DATE - 45, CURRENT_DATE + 60, 42000.00, 35, 'a2222222-2222-4222-8222-222222222222', now() - interval '45 days'),
  ('d1111111-1111-4111-8111-111111111303', 'b1111111-1111-4111-8111-111111111103', 'Andes Coffee — Brand refresh', 'completado', CURRENT_DATE - 110, CURRENT_DATE - 20, 9600.00, 100, 'a4444444-4444-4444-8444-444444444444', now() - interval '110 days'),
  ('d1111111-1111-4111-8111-111111111304', 'b1111111-1111-4111-8111-111111111105', 'Finora — Investor dashboard', 'activo', CURRENT_DATE - 30, CURRENT_DATE + 45, 54000.00, 42, 'a2222222-2222-4222-8222-222222222222', now() - interval '30 days'),
  ('d1111111-1111-4111-8111-111111111305', 'b1111111-1111-4111-8111-111111111108', 'Helix — Patient portal phase 1', 'pausado', CURRENT_DATE - 60, CURRENT_DATE + 90, 31000.00, 22, 'a2222222-2222-4222-8222-222222222222', now() - interval '60 days'),
  ('d1111111-1111-4111-8111-111111111306', 'b1111111-1111-4111-8111-111111111109', 'Copperline — Shopify storefront', 'completado', CURRENT_DATE - 150, CURRENT_DATE - 95, 14800.00, 100, 'a4444444-4444-4444-8444-444444444444', now() - interval '150 days');

-- ── Invoices ───────────────────────────────────────────────────────────────

INSERT INTO invoices (id, client_id, project_id, number, amount, currency, status, issue_date, due_date, paid_at, created_at) VALUES
  ('e1111111-1111-4111-8111-111111111401', 'b1111111-1111-4111-8111-111111111101', 'd1111111-1111-4111-8111-111111111301', 'INV-2026-001', 5500.00, 'USD', 'pagada', CURRENT_DATE - 140, CURRENT_DATE - 125, (CURRENT_DATE - 128)::timestamptz, now() - interval '140 days'),
  ('e1111111-1111-4111-8111-111111111402', 'b1111111-1111-4111-8111-111111111101', 'd1111111-1111-4111-8111-111111111301', 'INV-2026-014', 5500.00, 'USD', 'enviada', CURRENT_DATE - 12, CURRENT_DATE + 3, NULL, now() - interval '12 days'),
  ('e1111111-1111-4111-8111-111111111403', 'b1111111-1111-4111-8111-111111111102', 'd1111111-1111-4111-8111-111111111302', 'INV-2026-008', 14000.00, 'USD', 'pagada', CURRENT_DATE - 40, CURRENT_DATE - 25, (CURRENT_DATE - 27)::timestamptz, now() - interval '40 days'),
  ('e1111111-1111-4111-8111-111111111404', 'b1111111-1111-4111-8111-111111111103', 'd1111111-1111-4111-8111-111111111303', 'INV-2025-092', 9600.00, 'USD', 'pagada', CURRENT_DATE - 100, CURRENT_DATE - 85, (CURRENT_DATE - 88)::timestamptz, now() - interval '100 days'),
  ('e1111111-1111-4111-8111-111111111405', 'b1111111-1111-4111-8111-111111111105', 'd1111111-1111-4111-8111-111111111304', 'INV-2026-018', 18000.00, 'USD', 'enviada', CURRENT_DATE - 5, CURRENT_DATE + 10, NULL, now() - interval '5 days'),
  ('e1111111-1111-4111-8111-111111111406', 'b1111111-1111-4111-8111-111111111108', 'd1111111-1111-4111-8111-111111111305', 'INV-2026-011', 7750.00, 'USD', 'vencida', CURRENT_DATE - 35, CURRENT_DATE - 5, NULL, now() - interval '35 days'),
  ('e1111111-1111-4111-8111-111111111407', 'b1111111-1111-4111-8111-111111111109', 'd1111111-1111-4111-8111-111111111306', 'INV-2025-078', 14800.00, 'USD', 'pagada', CURRENT_DATE - 110, CURRENT_DATE - 95, (CURRENT_DATE - 97)::timestamptz, now() - interval '110 days'),
  ('e1111111-1111-4111-8111-111111111408', 'b1111111-1111-4111-8111-111111111102', NULL, 'INV-2026-020', 3200.00, 'USD', 'borrador', CURRENT_DATE, CURRENT_DATE + 15, NULL, now()),
  ('e1111111-1111-4111-8111-111111111409', 'b1111111-1111-4111-8111-111111111105', NULL, 'INV-2026-019', 9000.00, 'USD', 'enviada', CURRENT_DATE - 2, CURRENT_DATE + 13, NULL, now() - interval '2 days'),
  ('e1111111-1111-4111-8111-111111111410', 'b1111111-1111-4111-8111-111111111103', NULL, 'INV-2026-015', 2400.00, 'USD', 'pagada', CURRENT_DATE - 25, CURRENT_DATE - 10, (CURRENT_DATE - 12)::timestamptz, now() - interval '25 days');

-- ── Metrics snapshots (6 months) ───────────────────────────────────────────

INSERT INTO metrics_snapshots (month, mrr, new_mrr, churned_mrr, active_clients_count, created_at) VALUES
  (date_trunc('month', CURRENT_DATE - interval '5 months')::date, 18200.00, 3200.00, 800.00, 6, now() - interval '5 months'),
  (date_trunc('month', CURRENT_DATE - interval '4 months')::date, 21400.00, 4100.00, 900.00, 7, now() - interval '4 months'),
  (date_trunc('month', CURRENT_DATE - interval '3 months')::date, 23800.00, 3600.00, 1200.00, 7, now() - interval '3 months'),
  (date_trunc('month', CURRENT_DATE - interval '2 months')::date, 26100.00, 2900.00, 600.00, 8, now() - interval '2 months'),
  (date_trunc('month', CURRENT_DATE - interval '1 months')::date, 28450.00, 3100.00, 750.00, 8, now() - interval '1 months'),
  (date_trunc('month', CURRENT_DATE)::date, 31200.00, 3800.00, 1050.00, 9, now());

COMMIT;
