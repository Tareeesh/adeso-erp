-- =============================================
-- MIGRATION 003: Operations Module Tables
-- =============================================

-- Suppliers (vendor registry)
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  contact_person VARCHAR(255),
  tax_number VARCHAR(100),
  bank_details JSONB DEFAULT '{}',
  category VARCHAR(100),
  rating DECIMAL(3,2),
  is_active BOOLEAN DEFAULT true,
  documents JSONB DEFAULT '[]',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Travel Authorizations
CREATE TABLE travel_authorizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  requestor_id UUID NOT NULL REFERENCES users(id),
  traveler_name VARCHAR(255) NOT NULL,
  destination VARCHAR(500) NOT NULL,
  departure_date DATE NOT NULL,
  return_date DATE NOT NULL,
  purpose TEXT NOT NULL,
  transportation_mode VARCHAR(100),
  accommodation TEXT,
  estimated_cost DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'KES',
  per_diem DECIMAL(15,2),
  advance_requested DECIMAL(15,2),
  budget_line VARCHAR(255),
  additional_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Requisitions
CREATE TABLE purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  requestor_id UUID NOT NULL REFERENCES users(id),
  department VARCHAR(255),
  project_code VARCHAR(100),
  budget_line VARCHAR(255),
  required_by DATE,
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  justification TEXT,
  currency VARCHAR(10) DEFAULT 'KES',
  estimated_total DECIMAL(15,2),
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RFQ (Request for Quotation)
CREATE TABLE rfq (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  pr_id UUID REFERENCES purchase_requisitions(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  created_by UUID NOT NULL REFERENCES users(id),
  deadline DATE,
  instructions TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  invited_suppliers UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Quotes
CREATE TABLE supplier_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID NOT NULL REFERENCES rfq(id),
  supplier_id UUID REFERENCES suppliers(id),
  supplier_portal_link_id UUID REFERENCES supplier_portal_links(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  supplier_name VARCHAR(255),
  supplier_email VARCHAR(255),
  currency VARCHAR(10) DEFAULT 'KES',
  total_amount DECIMAL(15,2),
  delivery_days INT,
  validity_days INT,
  payment_terms TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  attachments JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','accepted','rejected')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bid Analysis
CREATE TABLE bid_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID NOT NULL REFERENCES rfq(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  created_by UUID NOT NULL REFERENCES users(id),
  criteria JSONB DEFAULT '[]',
  scores JSONB DEFAULT '[]',
  recommended_supplier_id UUID REFERENCES suppliers(id),
  recommended_quote_id UUID REFERENCES supplier_quotes(id),
  override_supplier_id UUID REFERENCES suppliers(id),
  override_justification TEXT,
  committee_notes TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Local Purchase Orders
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  pr_id UUID REFERENCES purchase_requisitions(id),
  rfq_id UUID REFERENCES rfq(id),
  bid_analysis_id UUID REFERENCES bid_analysis(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  created_by UUID NOT NULL REFERENCES users(id),
  supplier_id UUID REFERENCES suppliers(id),
  supplier_quote_id UUID REFERENCES supplier_quotes(id),
  delivery_address TEXT,
  delivery_date DATE,
  payment_terms TEXT,
  currency VARCHAR(10) DEFAULT 'KES',
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2),
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  delivery_status VARCHAR(30) DEFAULT 'pending' CHECK (delivery_status IN ('pending','partial','delivered','inspected','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery & Inspection
CREATE TABLE delivery_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  inspected_by UUID NOT NULL REFERENCES users(id),
  received_date DATE NOT NULL,
  items_received JSONB NOT NULL DEFAULT '[]',
  inspection_status VARCHAR(30) DEFAULT 'passed' CHECK (inspection_status IN ('passed','failed','partial')),
  inspection_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Requisitions
CREATE TABLE payment_requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  po_id UUID REFERENCES purchase_orders(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  created_by UUID NOT NULL REFERENCES users(id),
  payee_name VARCHAR(255),
  payee_account VARCHAR(100),
  payee_bank VARCHAR(255),
  currency VARCHAR(10) DEFAULT 'KES',
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_purpose TEXT,
  budget_line VARCHAR(255),
  payment_voucher_number VARCHAR(100),
  payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cab Requests
CREATE TABLE cab_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  requestor_id UUID NOT NULL REFERENCES users(id),
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  pickup_datetime TIMESTAMPTZ NOT NULL,
  return_datetime TIMESTAMPTZ,
  purpose TEXT NOT NULL,
  passengers INT DEFAULT 1,
  passenger_names JSONB DEFAULT '[]',
  special_requirements TEXT,
  assigned_vehicle VARCHAR(255),
  assigned_driver VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pr_company ON purchase_requisitions(company_id);
CREATE INDEX idx_po_company ON purchase_orders(company_id);
CREATE INDEX idx_rfq_pr ON rfq(pr_id);
CREATE INDEX idx_quotes_rfq ON supplier_quotes(rfq_id);
CREATE INDEX idx_cab_company ON cab_requests(company_id);
