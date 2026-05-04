-- =============================================
-- MIGRATION 002: Workflow & Signature Tables
-- =============================================

-- Documents (base table for all document types)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  document_number VARCHAR(100) NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','pending','in_progress','approved','rejected','completed','cancelled','deleted')),
  created_by UUID NOT NULL REFERENCES users(id),
  current_step INT DEFAULT 0,
  total_steps INT DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}',
  cc_users JSONB DEFAULT '[]',
  collaborating_companies UUID[],
  file_url TEXT,
  generated_pdf_url TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, document_number)
);

-- Workflow steps
CREATE TABLE workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  step_type VARCHAR(50) DEFAULT 'approval' CHECK (step_type IN ('approval','signature','review','action')),
  assigned_user_id UUID REFERENCES users(id),
  assigned_role VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped','rejected')),
  action_taken VARCHAR(50),
  comments TEXT,
  completed_at TIMESTAMPTZ,
  reminder_count INT DEFAULT 0,
  last_reminder_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, step_number)
);

-- Signatures
CREATE TABLE signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_step_id UUID REFERENCES workflow_steps(id),
  user_id UUID NOT NULL REFERENCES users(id),
  signature_type VARCHAR(20) NOT NULL CHECK (signature_type IN ('typed','drawn','uploaded')),
  signature_data TEXT NOT NULL,
  typed_name VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  is_valid BOOLEAN DEFAULT true,
  integrity_hash TEXT
);

-- Document attachments
CREATE TABLE document_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_step_id UUID REFERENCES workflow_steps(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type VARCHAR(100),
  attachment_type VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document comments
CREATE TABLE document_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  workflow_step_id UUID REFERENCES workflow_steps(id),
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier portal links
CREATE TABLE supplier_portal_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(255) NOT NULL UNIQUE,
  document_id UUID NOT NULL REFERENCES documents(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  supplier_email VARCHAR(255) NOT NULL,
  supplier_name VARCHAR(255),
  purpose VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','closed')),
  created_by UUID NOT NULL REFERENCES users(id),
  closed_by UUID REFERENCES users(id),
  accessed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document number sequences (per company per type)
CREATE TABLE document_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  document_type VARCHAR(100) NOT NULL,
  prefix VARCHAR(20) NOT NULL,
  last_number INT DEFAULT 0,
  UNIQUE(company_id, document_type)
);

-- Indexes
CREATE INDEX idx_documents_company ON documents(company_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_workflow_steps_document ON workflow_steps(document_id);
CREATE INDEX idx_workflow_steps_assigned ON workflow_steps(assigned_user_id, status);
CREATE INDEX idx_signatures_document ON signatures(document_id);
CREATE INDEX idx_supplier_links_token ON supplier_portal_links(token);
