const express = require('express')
const router = express.Router()
const { authenticate, requireGlobalAdmin, requireRole } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { query } = require('../config/database')
const { upload } = require('../middleware/upload')
const { uploadFile } = require('../config/storage')

router.get('/', authenticate, asyncHandler(async (req, res) => {
  if (req.user.is_global_admin) {
    const { rows } = await query('SELECT * FROM companies ORDER BY name')
    return res.json(rows)
  }
  const { rows } = await query(
    `SELECT c.* FROM companies c JOIN user_companies uc ON c.id=uc.company_id
     WHERE uc.user_id=$1 AND uc.status='active'`,
    [req.user.id]
  )
  res.json(rows)
}))

router.post('/', authenticate, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const { name, domain, email, address, phone, country, currency } = req.body
  const { rows: [company] } = await query(
    `INSERT INTO companies (name, domain, email, address, phone, country, currency) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, domain, email, address, phone, country || 'Kenya', currency || 'KES']
  )

  // Add document sequences for new company
  const docTypes = [
    ['travel_authorization','TA'],['purchase_requisition','PR'],['rfq','RFQ'],
    ['purchase_order','LPO'],['payment_requisition','PMT'],['cab_request','CAB'],
    ['recruitment_request','REC'],['offer_letter','OFR'],['asset_assignment','AA'],['store_request','SR']
  ]
  for (const [type, prefix] of docTypes) {
    await query(
      `INSERT INTO document_sequences (company_id, document_type, prefix, last_number) VALUES ($1,$2,$3,0)`,
      [company.id, type, prefix]
    )
  }

  res.status(201).json(company)
}))

router.put('/:id', authenticate, requireRole('company_admin', 'global_admin'), asyncHandler(async (req, res) => {
  const { name, email, address, phone, country, currency, settings } = req.body
  const { rows: [company] } = await query(
    `UPDATE companies SET name=$1, email=$2, address=$3, phone=$4, country=$5, currency=$6, settings=$7, updated_at=NOW()
     WHERE id=$8 RETURNING *`,
    [name, email, address, phone, country, currency, JSON.stringify(settings || {}), req.params.id]
  )
  res.json(company)
}))

router.post('/:id/logo', authenticate, requireRole('company_admin', 'global_admin'), upload.single('logo'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' })
  const key = await uploadFile(req.file.buffer, req.file.originalname, `company-logos/${req.params.id}`)
  await query('UPDATE companies SET logo_url=$1 WHERE id=$2', [key, req.params.id])
  res.json({ logoUrl: key })
}))

router.get('/:id/departments', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM departments WHERE company_id=$1 AND is_active=true ORDER BY name',
    [req.params.id]
  )
  res.json(rows)
}))

router.post('/:id/departments', authenticate, requireRole('company_admin', 'hr_manager', 'global_admin'), asyncHandler(async (req, res) => {
  const { name, code, headId, parentId } = req.body
  const { rows: [dep] } = await query(
    `INSERT INTO departments (company_id, name, code, head_id, parent_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.id, name, code, headId, parentId]
  )
  res.status(201).json(dep)
}))

module.exports = router
