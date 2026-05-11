-- =============================================
-- MIGRATION 008: External Signatories & User Edit
-- =============================================

-- External signatory support on workflow steps
ALTER TABLE workflow_steps
  ADD COLUMN IF NOT EXISTS external_name  VARCHAR(200),
  ADD COLUMN IF NOT EXISTS external_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS external_token VARCHAR(64)
    DEFAULT encode(gen_random_bytes(32), 'hex');

-- Ensure every existing row has a token
UPDATE workflow_steps SET external_token = encode(gen_random_bytes(32), 'hex')
  WHERE external_token IS NULL;

-- Add CBA and GRN document sequence types
INSERT INTO document_sequences (company_id, document_type, prefix, last_number)
SELECT c.id, dt.doc_type, dt.prefix, 0
FROM companies c
CROSS JOIN (VALUES
  ('comparative_bid_analysis', 'CBA'),
  ('goods_received_note',      'GRN'),
  ('it_request',               'ITR')
) AS dt(doc_type, prefix)
ON CONFLICT DO NOTHING;
