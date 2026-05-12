const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query } = require('../../config/database')
const { auditLog } = require('../../middleware/audit')

const guard = [authenticate]

router.get('/', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ba.*, d.document_number AS rfq_number, d.title AS rfq_title,
            rs.name AS recommended_supplier_name,
            u.first_name || ' ' || u.last_name AS created_by_name
     FROM bid_analysis ba
     JOIN rfq r ON ba.rfq_id = r.id
     JOIN documents d ON r.document_id = d.id
     LEFT JOIN suppliers rs ON ba.recommended_supplier_id = rs.id
     LEFT JOIN users u ON ba.created_by = u.id
     WHERE ba.company_id = $1
     ORDER BY ba.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.get('/rfq/:rfqId', ...guard, asyncHandler(async (req, res) => {
  const { rfqId } = req.params
  const { rows: [rfq] } = await query(
    `SELECT r.*, d.document_number, d.title AS doc_title,
            pr.items AS pr_items, pr.currency, pr.department, pr.budget_line
     FROM rfq r
     JOIN documents d ON r.document_id = d.id
     LEFT JOIN purchase_requisitions pr ON r.pr_id = pr.id
     WHERE r.id = $1 AND r.company_id = $2`,
    [rfqId, req.user.companyId]
  )
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' })

  const { rows: quotes } = await query(
    `SELECT sq.*, COALESCE(s.name, sq.supplier_name) AS display_name
     FROM supplier_quotes sq
     LEFT JOIN suppliers s ON sq.supplier_id = s.id
     WHERE sq.rfq_id = $1 AND sq.company_id = $2
     ORDER BY sq.total_amount ASC NULLS LAST`,
    [rfqId, req.user.companyId]
  )

  const { rows: [analysis] } = await query(
    `SELECT ba.*, rs.name AS recommended_supplier_name,
            u.first_name || ' ' || u.last_name AS created_by_name
     FROM bid_analysis ba
     LEFT JOIN suppliers rs ON ba.recommended_supplier_id = rs.id
     LEFT JOIN users u ON ba.created_by = u.id
     WHERE ba.rfq_id = $1 AND ba.company_id = $2`,
    [rfqId, req.user.companyId]
  )
  res.json({ rfq, quotes, analysis: analysis || null })
}))

router.get('/:id', ...guard, asyncHandler(async (req, res) => {
  const { rows: [analysis] } = await query(
    `SELECT ba.*, rs.name AS recommended_supplier_name,
            u.first_name || ' ' || u.last_name AS created_by_name
     FROM bid_analysis ba
     LEFT JOIN suppliers rs ON ba.recommended_supplier_id = rs.id
     LEFT JOIN users u ON ba.created_by = u.id
     WHERE ba.id = $1 AND ba.company_id = $2`,
    [req.params.id, req.user.companyId]
  )
  if (!analysis) return res.status(404).json({ error: 'Not found' })
  res.json(analysis)
}))

router.post('/', ...guard, asyncHandler(async (req, res) => {
  const { rfqId, criteria, scores, recommendedSupplierId, recommendedQuoteId,
          overrideSupplierId, overrideJustification, committeeNotes } = req.body
  if (!rfqId) return res.status(400).json({ error: 'rfqId required' })

  const { rows: [rfq] } = await query(
    'SELECT id FROM rfq WHERE id=$1 AND company_id=$2',
    [rfqId, req.user.companyId]
  )
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' })

  const { rows: [existing] } = await query(
    'SELECT id FROM bid_analysis WHERE rfq_id=$1 AND company_id=$2',
    [rfqId, req.user.companyId]
  )
  if (existing) return res.status(400).json({ error: 'Bid analysis already exists for this RFQ' })

  const { rows: [analysis] } = await query(
    `INSERT INTO bid_analysis (rfq_id, company_id, created_by, criteria, scores,
      recommended_supplier_id, recommended_quote_id, override_supplier_id,
      override_justification, committee_notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft') RETURNING *`,
    [rfqId, req.user.companyId, req.user.id,
     JSON.stringify(criteria || []), JSON.stringify(scores || {}),
     recommendedSupplierId || null, recommendedQuoteId || null,
     overrideSupplierId || null, overrideJustification || null, committeeNotes || null]
  )
  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'CREATE_BID_ANALYSIS', entityType: 'bid_analysis', entityId: analysis.id, req })
  res.status(201).json(analysis)
}))

router.put('/:id', ...guard, asyncHandler(async (req, res) => {
  const { criteria, scores, recommendedSupplierId, recommendedQuoteId,
          overrideSupplierId, overrideJustification, committeeNotes } = req.body
  const { rows: [a] } = await query(
    'SELECT * FROM bid_analysis WHERE id=$1 AND company_id=$2',
    [req.params.id, req.user.companyId]
  )
  if (!a) return res.status(404).json({ error: 'Not found' })
  if (a.status === 'approved') return res.status(400).json({ error: 'Approved analysis cannot be edited' })

  const { rows: [updated] } = await query(
    `UPDATE bid_analysis SET criteria=$1, scores=$2, recommended_supplier_id=$3,
      recommended_quote_id=$4, override_supplier_id=$5, override_justification=$6,
      committee_notes=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
    [JSON.stringify(criteria !== undefined ? criteria : a.criteria),
     JSON.stringify(scores !== undefined ? scores : a.scores),
     recommendedSupplierId !== undefined ? recommendedSupplierId : a.recommended_supplier_id,
     recommendedQuoteId !== undefined ? recommendedQuoteId : a.recommended_quote_id,
     overrideSupplierId !== undefined ? overrideSupplierId : a.override_supplier_id,
     overrideJustification !== undefined ? overrideJustification : a.override_justification,
     committeeNotes !== undefined ? committeeNotes : a.committee_notes,
     req.params.id]
  )
  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'UPDATE_BID_ANALYSIS', entityType: 'bid_analysis', entityId: req.params.id, req })
  res.json(updated)
}))

router.post('/:id/submit', ...guard, asyncHandler(async (req, res) => {
  const { rows: [a] } = await query(
    'SELECT * FROM bid_analysis WHERE id=$1 AND company_id=$2',
    [req.params.id, req.user.companyId]
  )
  if (!a) return res.status(404).json({ error: 'Not found' })
  if (a.status !== 'draft') return res.status(400).json({ error: 'Only draft analysis can be submitted' })
  if (!a.recommended_supplier_id && !a.override_supplier_id)
    return res.status(400).json({ error: 'Select a recommended supplier before submitting' })
  await query("UPDATE bid_analysis SET status='reviewed', updated_at=NOW() WHERE id=$1", [req.params.id])
  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'SUBMIT_BID_ANALYSIS', entityType: 'bid_analysis', entityId: req.params.id, req })
  res.json({ success: true, status: 'reviewed' })
}))

router.post('/:id/approve', ...guard, asyncHandler(async (req, res) => {
  const { rows: [a] } = await query(
    'SELECT * FROM bid_analysis WHERE id=$1 AND company_id=$2',
    [req.params.id, req.user.companyId]
  )
  if (!a) return res.status(404).json({ error: 'Not found' })
  if (a.status === 'approved') return res.status(400).json({ error: 'Already approved' })
  await query("UPDATE bid_analysis SET status='approved', updated_at=NOW() WHERE id=$1", [req.params.id])
  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'APPROVE_BID_ANALYSIS', entityType: 'bid_analysis', entityId: req.params.id, req })
  res.json({ success: true, status: 'approved' })
}))

module.exports = router
