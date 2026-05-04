-- =============================================
-- MIGRATION 007: Seed Data
-- =============================================

-- System Roles
INSERT INTO roles (name, display_name, description, is_system_role, permissions) VALUES
('global_admin',       'Global Admin',          'Full system access across all companies',          true, '["*"]'),
('company_admin',      'Company Admin',         'Full access within their company',                 true, '["company.*"]'),
('hr_manager',         'HR Manager',            'Manages all HR processes',                         true, '["hr.*"]'),
('line_manager',       'Line Manager',          'Approves requests for their team',                 true, '["approvals.line_manager"]'),
('requestor',          'Requestor',             'Can create and submit requests',                   true, '["requests.create"]'),
('operations',         'Operations/Logistics',  'Manages procurement and logistics',                true, '["operations.*"]'),
('budget_approver',    'Budget Approver',       'Approves budget-related requests',                 true, '["approvals.budget"]'),
('finance',            'Finance',               'Finance processing and payment vouchers',          true, '["finance.*"]'),
('supplier',           'Supplier',              'External supplier with limited portal access',     true, '["supplier.portal"]'),
('inventory_officer',  'Inventory Officer',     'Manages inventory and stock',                      true, '["inventory.*"]'),
('asset_officer',      'Asset Officer',         'Manages asset registry',                           true, '["assets.*"]'),
('it_administrator',   'IT Administrator',      'Manages IT account requests and system access',    true, '["it.*"]');

-- System Modules
INSERT INTO modules (code, name, description, icon) VALUES
('operations',   'Operations',             'Travel, procurement, cab requests',         'briefcase'),
('hr',           'Human Resources',        'Recruitment, onboarding, performance',      'users'),
('assets',       'Asset Registry',         'Asset tracking and management',             'package'),
('inventory',    'Inventory Management',   'Stock and warehouse management',            'archive'),
('admin',        'Administration',         'System administration and settings',        'settings'),
('reports',      'Reports & Analytics',    'Cross-module reporting',                    'bar-chart');

-- Role-Module access defaults
INSERT INTO role_module_access (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name IN ('global_admin', 'company_admin');

INSERT INTO role_module_access (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'hr_manager' AND m.code IN ('hr', 'reports');

INSERT INTO role_module_access (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name IN ('operations', 'budget_approver') AND m.code IN ('operations', 'reports');

INSERT INTO role_module_access (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'finance' AND m.code IN ('operations', 'reports');

INSERT INTO role_module_access (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name IN ('requestor', 'line_manager') AND m.code = 'operations';

INSERT INTO role_module_access (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'inventory_officer' AND m.code IN ('inventory', 'reports');

INSERT INTO role_module_access (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'asset_officer' AND m.code IN ('assets', 'reports');

INSERT INTO role_module_access (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'it_administrator' AND m.code IN ('hr', 'admin');

-- Default Companies
INSERT INTO companies (name, domain, email, country, currency) VALUES
('ADESO Africa', 'adesoafrica.org', 'info@adesoafrica.org', 'Kenya', 'KES'),
('Kuja', 'kuja.org', 'info@kuja.org', 'Kenya', 'KES');

-- Global Admin User (password: Admin@1234 — MUST be changed on first login)
INSERT INTO users (
  email, password_hash, first_name, last_name,
  job_title, is_global_admin, timezone
) VALUES (
  'thussein@adesoafrica.org',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGX4Q5v.ZJMq1bPdJcTxP8VY.eG',
  'Tarish', 'Hussein',
  'Global Administrator', true, 'Africa/Nairobi'
);

-- Link global admin to ADESO company as admin
INSERT INTO user_companies (user_id, company_id, role_id, is_primary, status, approved_at)
SELECT u.id, c.id, r.id, true, 'active', NOW()
FROM users u, companies c, roles r
WHERE u.email = 'thussein@adesoafrica.org'
  AND c.domain = 'adesoafrica.org'
  AND r.name = 'global_admin';

-- Document sequences
INSERT INTO document_sequences (company_id, document_type, prefix, last_number)
SELECT c.id, dt.doc_type, dt.prefix, 0
FROM companies c
CROSS JOIN (VALUES
  ('travel_authorization', 'TA'),
  ('purchase_requisition', 'PR'),
  ('rfq',                  'RFQ'),
  ('purchase_order',       'LPO'),
  ('payment_requisition',  'PMT'),
  ('cab_request',          'CAB'),
  ('recruitment_request',  'REC'),
  ('offer_letter',         'OFR'),
  ('asset_assignment',     'AA'),
  ('store_request',        'SR')
) AS dt(doc_type, prefix);
