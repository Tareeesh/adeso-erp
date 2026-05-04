-- =============================================
-- MIGRATION 006: Inventory Management Tables
-- =============================================

-- Warehouses / Store Locations
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  type VARCHAR(50) DEFAULT 'warehouse' CHECK (type IN ('warehouse','office','field','store')),
  location VARCHAR(500),
  manager_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- Inventory Categories
CREATE TABLE inventory_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Items
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES inventory_categories(id),
  unit_of_measure VARCHAR(50) NOT NULL,
  unit_price DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'KES',
  reorder_level INT DEFAULT 0,
  is_expirable BOOLEAN DEFAULT false,
  qr_code_url TEXT,
  qr_code_data TEXT,
  image_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sku)
);

-- Stock (quantity per warehouse per item)
CREATE TABLE stock_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  quantity DECIMAL(15,3) DEFAULT 0,
  reserved_quantity DECIMAL(15,3) DEFAULT 0,
  expiry_date DATE,
  batch_number VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, warehouse_id, batch_number)
);

-- Stock Movements
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('stock_in','stock_out','transfer','adjustment','return','damage','expired')),
  quantity DECIMAL(15,3) NOT NULL,
  unit_price DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'KES',
  reference_type VARCHAR(100),
  reference_id UUID,
  reason TEXT,
  batch_number VARCHAR(100),
  expiry_date DATE,
  performed_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store Requests
CREATE TABLE store_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  requestor_id UUID NOT NULL REFERENCES users(id),
  warehouse_id UUID REFERENCES warehouses(id),
  department_id UUID REFERENCES departments(id),
  required_by DATE,
  purpose TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','partial','issued','rejected','cancelled')),
  issued_by UUID REFERENCES users(id),
  issued_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store Request Items (issued quantities)
CREATE TABLE store_request_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_request_id UUID NOT NULL REFERENCES store_requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  requested_quantity DECIMAL(15,3) NOT NULL,
  approved_quantity DECIMAL(15,3),
  issued_quantity DECIMAL(15,3),
  unit_price DECIMAL(15,2),
  notes TEXT
);

-- Stock Transfer Requests
CREATE TABLE stock_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','in_transit','completed','rejected')),
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  transfer_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Count / Audit
CREATE TABLE stock_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  conducted_by UUID NOT NULL REFERENCES users(id),
  count_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Stock Count Items
CREATE TABLE stock_count_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  system_quantity DECIMAL(15,3),
  counted_quantity DECIMAL(15,3),
  variance DECIMAL(15,3),
  notes TEXT
);

-- Low Stock Alerts
CREATE TABLE low_stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  current_quantity DECIMAL(15,3),
  reorder_level DECIMAL(15,3),
  alert_type VARCHAR(20) CHECK (alert_type IN ('low_stock','out_of_stock','expiry_soon')),
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inventory_items_company ON inventory_items(company_id);
CREATE INDEX idx_stock_levels_item ON stock_levels(item_id);
CREATE INDEX idx_stock_levels_warehouse ON stock_levels(warehouse_id);
CREATE INDEX idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX idx_stock_movements_company ON stock_movements(company_id);
CREATE INDEX idx_store_requests_company ON store_requests(company_id);
CREATE INDEX idx_low_stock_company ON low_stock_alerts(company_id, is_resolved);
