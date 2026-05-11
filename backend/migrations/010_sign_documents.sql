CREATE TABLE IF NOT EXISTS sign_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(500),
  file_type VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  final_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sign_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES sign_documents(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL,
  order_num INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  sign_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  signed_at TIMESTAMPTZ,
  signature_data TEXT,
  signature_type VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS sign_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES sign_documents(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES sign_recipients(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  x_pct FLOAT NOT NULL,
  y_pct FLOAT NOT NULL,
  w_pct FLOAT NOT NULL,
  h_pct FLOAT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sign_recipients_token ON sign_recipients(sign_token);
CREATE INDEX IF NOT EXISTS idx_sign_recipients_doc ON sign_recipients(document_id);
CREATE INDEX IF NOT EXISTS idx_sign_fields_doc ON sign_fields(document_id);
