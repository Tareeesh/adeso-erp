const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query } = require('../../config/database')
const { auditLog } = require('../../middleware/audit')

const guard = [authenticate]

const DEFAULT_CHECKLIST = [
  { key: 'pr', label: 'Purchase Requisition filed', checked: false },
  { key: 'rfq', label: 'RFQ / Quotations filed', checked: false },
  { key: 'bid_analysis', label: 'Bid Analysis approved', checked: false },
  { key: 'po', label: 'Purchase Order signed', checked: false },
  { key: 'delivery', label: 'Delivery Note / GRN filed', checked: false },
  { key: 'invoice', label: 'Invoice received & verified', checked: false },
  { key: 'withholding_tax', label: 'Withholding Tax certificate filed', checked: false },
  { key: 'sam_check', label: 'SAM / Vendor screening check completed', checked: false },
  { key: 'payment', label: 'Payment Requisition filed & approved', checked: false },
]

router.get('/', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT dc.*, d.document_number, d.title AS doc_title, d.document_type,
            u.first_name || ' ' || u.last_name AS closed_by_name
     FROM dossier_closures dc
     JOIN documents d ON dc.document_id = d.id
     JOIN users u ON dc.closed_by = u.id
     WHERE dc.company_id = $1
     ORDER BY dc.closed_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.get('/po/:poId', ...guard, asyncHandler(async (req, res) => {
  const { rows: [po] } = await query(
    `SELECT po.*, d.document_number, d.title AS doc_title
     FROM purchase_orders po
     JOIN documents d ON po.document_id = d.id
     WHERE po.id = $1 AND po.company_id = $2`,
    [req.params.poId, req.user.companyId]
  )
  if (!po) return res.status(404).json({ error: 'Purchase Order not found' })

  const { rows: [dossier] } = await query(
    `SELECT dc.*, u.first_name || ' ' || u.last_name AS closed_by_name
     FROM dossier_closures dc
     LEFT JOIN users u ON dc.closed_by = u.id
     WHERE dc.document_id = $1 AND dc.company_id = $2`,
    [po.document_id, req.user.companyId]
  )
  res.json({ po, dossier: dossier || null, defaultChecklist: DEFAULT_CHECKLIST })
}))

router.get('/:id', ...guard, asyncHandler(async (req, res) => {
  const { rows: [dc] } = await query(
    `SELECT dc.*, d.document_number, d.title AS doc_title,
            u.first_name || ' ' || u.last_name AS closed_by_name
     FROM dossier_closures dc
     JOIN documents d ON dc.document_id = d.id
     JOIN users u ON dc.closed_by = u.id
     WHERE dc.id = $1 AND dc.company_id = $2`,
    [req.params.id, req.user.companyId]
  )
  if (!dc) return res.status(404).json({ error: 'Not found' })
  res.json(dc)
}))

router.post('/', ...guard, asyncHandler(async (req, res) => {
  const { documentId, closureNotes, checklistItems } = req.body
  if (!documentId) return res.status(400).json({ error: 'documentId is required' })

  const { rows: [doc] } = await query(
    'SELECT id FROM documents WHERE id=$1 AND company_id=$2',
    [documentId, req.user.companyId]
  )
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  const items = checklistItems || DEFAULT_CHECKLIST
  const allChecked = items.every(i => i.checked)

  const { rows: [dossier] } = await query(
    `INSERT INTO dossier_closures (document_id, company_id, closed_by, closure_notes, checklist_items, all_checked)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [documentId, req.user.companyId, req.user.id, closureNotes || null, JSON.stringify(items), allChecked]
  )
  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'CREATE_DOSSIER', entityType: 'dossier_closure', entityId: dossier.id, req })
  res.status(201).json(dossier)
}))

router.put('/:id', ...guard, asyncHandler(async (req, res) => {
  const { closureNotes, checklistItems } = req.body
  const { rows: [dc] } = await query(
    'SELECT * FROM dossier_closures WHERE id=$1 AND company_id=$2',
    [req.params.id, req.user.companyId]
  )
  if (!dc) return res.status(404).json({ error: 'Not found' })

  const items = checklistItems || dc.checklist_items
  const allChecked = items.every(i => i.checked)

  const { rows: [updated] } = await query(
    'UPDATE dossier_closures SET closure_notes=$1, checklist_items=$2, all_checked=$3 WHERE id=$4 RETURNING *',
    [closureNotes !== undefined ? closureNotes : dc.closure_notes, JSON.stringify(items), allChecked, req.params.id]
  )
  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'UPDATE_DOSSIER', entityType: 'dossier_closure', entityId: req.params.id, req })
  res.json(updated)
}))

module.exports = router
