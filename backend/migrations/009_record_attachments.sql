CREATE TABLE IF NOT EXISTS record_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  record_type VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_record_attachments_lookup
  ON record_attachments(company_id, record_type, record_id);
