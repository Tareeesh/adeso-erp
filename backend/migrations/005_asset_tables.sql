-- =============================================
-- MIGRATION 005: Asset Registry Tables
-- =============================================

-- Asset Categories
CREATE TABLE asset_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  depreciation_rate DECIMAL(5,2),
  useful_life_years INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  asset_id_code VARCHAR(100) NOT NULL,
  category_id UUID REFERENCES asset_categories(id),
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(255),
  purchase_date DATE,
  purchase_cost DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'KES',
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name VARCHAR(255),
  warranty_expiry DATE,
  condition VARCHAR(30) DEFAULT 'good' CHECK (condition IN ('new','good','fair','poor','damaged')),
  status VARCHAR(30) DEFAULT 'available' CHECK (status IN ('available','assigned','under_maintenance','lost','damaged','retired','disposed')),
  office_location VARCHAR(255),
  department_id UUID REFERENCES departments(id),
  assigned_to UUID REFERENCES employees(id),
  assigned_at TIMESTAMPTZ,
  qr_code_url TEXT,
  notes TEXT,
  documents JSONB DEFAULT '[]',
  depreciation_value DECIMAL(15,2),
  book_value DECIMAL(15,2),
  disposal_date DATE,
  disposal_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, asset_id_code)
);

-- Asset Assignments
CREATE TABLE asset_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id),
  asset_id UUID NOT NULL REFERENCES assets(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  assigned_to UUID NOT NULL REFERENCES employees(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  assignment_date DATE NOT NULL,
  expected_return_date DATE,
  actual_return_date DATE,
  purpose TEXT,
  condition_at_assignment VARCHAR(30),
  condition_at_return VARCHAR(30),
  handover_notes TEXT,
  acknowledgment_signature TEXT,
  return_notes TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','returned','overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset Maintenance
CREATE TABLE asset_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  maintenance_type VARCHAR(50) CHECK (maintenance_type IN ('scheduled','repair','inspection','calibration','upgrade')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_date DATE,
  completed_date DATE,
  vendor_name VARCHAR(255),
  vendor_contact VARCHAR(255),
  cost DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'KES',
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  notes TEXT,
  next_maintenance_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset Audits
CREATE TABLE asset_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  conducted_by UUID NOT NULL REFERENCES users(id),
  audit_date DATE NOT NULL,
  department_id UUID REFERENCES departments(id),
  location VARCHAR(255),
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  total_assets INT DEFAULT 0,
  verified_count INT DEFAULT 0,
  missing_count INT DEFAULT 0,
  damaged_count INT DEFAULT 0,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset Audit Items
CREATE TABLE asset_audit_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES asset_audits(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id),
  expected_location VARCHAR(255),
  found_location VARCHAR(255),
  condition_found VARCHAR(30),
  is_verified BOOLEAN DEFAULT false,
  is_missing BOOLEAN DEFAULT false,
  notes TEXT,
  verified_at TIMESTAMPTZ
);

-- Asset Movements (status change history)
CREATE TABLE asset_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  from_employee UUID REFERENCES employees(id),
  to_employee UUID REFERENCES employees(id),
  from_location VARCHAR(255),
  to_location VARCHAR(255),
  reason TEXT,
  performed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assets_company ON assets(company_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_assigned ON assets(assigned_to);
CREATE INDEX idx_asset_assignments_asset ON asset_assignments(asset_id);
CREATE INDEX idx_asset_maintenance_asset ON asset_maintenance(asset_id);
