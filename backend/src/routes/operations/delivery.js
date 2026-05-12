const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query } = require('../../config/database')
const { auditLog } = require('../../middleware/audit')

const guard = [authenticate]

router.get('/', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT di.*,
            po.supplier_name, po.total_amount, po.currency,
            d.document_number AS po_number, d.title AS po_title,
            u.first_name || ' ' || u.last_name AS inspected_by_name
     FROM delivery_inspections di
     JOIN purchase_orders po ON di.po_id = po.id
     JOIN documents d ON po.document_id = d.id
     JOIN users u ON di.inspected_by = u.id
     WHERE di.company_id = $1
     ORDER BY di.created_at DESC`,
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

  const { rows: deliveries } = await query(
    `SELECT di.*, u.first_name || ' ' || u.last_name AS inspected_by_name
     FROM delivery_inspections di
     JOIN users u ON di.inspected_by = u.id
     WHERE di.po_id = $1 AND di.company_id = $2
     ORDER BY di.created_at DESC`,
    [req.params.poId, req.user.companyId]
  )
  res.json({ po, deliveries })
}))

router.post('/', ...guard, asyncHandler(async (req, res) => {
  const { poId, receivedDate, itemsReceived, inspectionStatus, inspectionNotes } = req.body
  if (!poId) return res.status(400).json({ error: 'poId is required' })
  if (!receivedDate) return res.status(400).json({ error: 'receivedDate is required' })
  if (!itemsReceived || !itemsReceived.length)
    return res.status(400).json({ error: 'At least one item received is required' })

  const { rows: [po] } = await query(
    'SELECT * FROM purchase_orders WHERE id=$1 AND company_id=$2',
    [poId, req.user.companyId]
  )
  if (!po) return res.status(404).json({ error: 'Purchase Order not found' })

  const status = inspectionStatus || 'passed'
  const { rows: [delivery] } = await query(
    `INSERT INTO delivery_inspections
     (po_id, company_id, inspected_by, received_date, items_received, inspection_status, inspection_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [poId, req.user.companyId, req.user.id, receivedDate,
     JSON.stringify(itemsReceived), status, inspectionNotes || null]
  )

  await query(
    'UPDATE purchase_orders SET delivery_status=$1, updated_at=NOW() WHERE id=$2',
    [status, poId]
  )

  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'RECORD_DELIVERY', entityType: 'delivery_inspection', entityId: delivery.id, req })
  res.status(201).json(delivery)
}))

router.put('/:id', ...guard, asyncHandler(async (req, res) => {
  const { receivedDate, itemsReceived, inspectionStatus, inspectionNotes } = req.body
  const { rows: [d] } = await query(
    'SELECT * FROM delivery_inspections WHERE id=$1 AND company_id=$2',
    [req.params.id, req.user.companyId]
  )
  if (!d) return res.status(404).json({ error: 'Not found' })

  const { rows: [updated] } = await query(
    `UPDATE delivery_inspections SET received_date=$1, items_received=$2,
      inspection_status=$3, inspection_notes=$4 WHERE id=$5 RETURNING *`,
    [receivedDate || d.received_date,
     JSON.stringify(itemsReceived || d.items_received),
     inspectionStatus || d.inspection_status,
     inspectionNotes !== undefined ? inspectionNotes : d.inspection_notes,
     req.params.id]
  )
  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'UPDATE_DELIVERY', entityType: 'delivery_inspection', entityId: req.params.id, req })
  res.json(updated)
}))

module.exports = router
