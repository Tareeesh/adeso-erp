const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { requireModule } = require('../../middleware/rbac')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query, transaction } = require('../../config/database')
const { createWorkflow } = require('../../services/workflowEngine')
const { auditLog } = require('../../middleware/audit')

const guard = [authenticate, requireModule('operations')]

// ---- PURCHASE REQUISITIONS ----

router.get('/requisitions', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT pr.*, d.document_number, d.status, d.created_at, d.title,
            u.first_name || ' ' || u.last_name AS requestor_name
     FROM purchase_requisitions pr
     JOIN documents d ON pr.document_id = d.id
     JOIN users u ON pr.requestor_id = u.id
     WHERE pr.company_id=$1 AND d.status != 'deleted'
     ORDER BY d.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.post('/requisitions', ...guard, asyncHandler(async (req, res) => {
  const { title, department, projectCode, budgetLine, requiredBy, priority, justification, currency, estimatedTotal, items, steps, ccUsers, collaboratingCompanies } = req.body

  const result = await transaction(async (client) => {
    const doc = await createWorkflow({
      companyId: req.user.companyId, documentType: 'purchase_requisition',
      title: title || 'Purchase Requisition', createdBy: req.user.id,
      steps, ccUsers, collaboratingCompanies,
      metadata: { estimatedTotal, currency: currency || 'KES', department, budgetLine },
      client,
    })

    const { rows: [pr] } = await client.query(
      `INSERT INTO purchase_requisitions (document_id, company_id, requestor_id, department, project_code, budget_line, required_by, priority, justification, currency, estimated_total, items)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [doc.id, req.user.companyId, req.user.id, department, projectCode, budgetLine, requiredBy, priority || 'normal', justification, currency || 'KES', estimatedTotal, JSON.stringify(items || [])]
    )

    return { document: doc, requisition: pr }
  })

  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'CREATE_PR', entityType: 'purchase_requisition', entityId: result.requisition.id, req })
  res.status(201).json(result)
}))

router.get('/requisitions/by-document/:documentId', ...guard, asyncHandler(async (req, res) => {
  const { rows: [pr] } = await query(
    `SELECT pr.*, d.status AS doc_status, d.created_by AS doc_created_by
     FROM purchase_requisitions pr
     JOIN documents d ON pr.document_id=d.id
     WHERE pr.document_id=$1 AND pr.company_id=$2`,
    [req.params.documentId, req.user.companyId]
  )
  if (!pr) return res.status(404).json({ error: 'Not found' })
  res.json(pr)
}))

router.put('/requisitions/:prId', ...guard, asyncHandler(async (req, res) => {
  const { department, projectCode, budgetLine, requiredBy, priority, justification, currency, estimatedTotal, items } = req.body

  const { rows: [pr] } = await query(
    `SELECT pr.*, d.status AS doc_status
     FROM purchase_requisitions pr
     JOIN documents d ON pr.document_id=d.id
     WHERE pr.id=$1 AND pr.company_id=$2`,
    [req.params.prId, req.user.companyId]
  )
  if (!pr) return res.status(404).json({ error: 'Not found' })
  if (pr.doc_status !== 'draft') return res.status(400).json({ error: 'Only draft requisitions can be edited' })

  await transaction(async (client) => {
    await client.query(
      `UPDATE purchase_requisitions
       SET department=$1, project_code=$2, budget_line=$3, required_by=$4, priority=$5,
           justification=$6, currency=$7, estimated_total=$8, items=$9
       WHERE id=$10`,
      [department, projectCode, budgetLine, requiredBy || null, priority || 'normal', justification, currency || 'KES', estimatedTotal, JSON.stringify(items || []), req.params.prId]
    )
    await client.query(
      `UPDATE documents SET metadata=$1 WHERE id=$2`,
      [JSON.stringify({ estimatedTotal, currency: currency || 'KES', department, budgetLine }), pr.document_id]
    )
  })

  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'UPDATE_PR', entityType: 'purchase_requisition', entityId: req.params.prId, req })
  const { rows: [updated] } = await query('SELECT * FROM purchase_requisitions WHERE id=$1', [req.params.prId])
  res.json(updated)
}))

router.get('/requisitions/:id', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT pr.*, d.*, u.first_name || ' ' || u.last_name AS requestor_name
     FROM purchase_requisitions pr
     JOIN documents d ON pr.document_id=d.id
     JOIN users u ON pr.requestor_id=u.id
     WHERE pr.id=$1 AND pr.company_id=$2`,
    [req.params.id, req.user.companyId]
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
}))

// ---- RFQ ----

router.post('/rfq', ...guard, asyncHandler(async (req, res) => {
  const { prId, title, deadline, instructions, items, invitedSuppliers, steps, ccUsers } = req.body

  const result = await transaction(async (client) => {
    const doc = await createWorkflow({
      companyId: req.user.companyId, documentType: 'rfq',
      title: title || 'Request for Quotation', createdBy: req.user.id,
      steps: steps || [], ccUsers, client,
    })

    const { rows: [rfq] } = await client.query(
      `INSERT INTO rfq (document_id, pr_id, company_id, created_by, deadline, instructions, items, invited_suppliers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [doc.id, prId, req.user.companyId, req.user.id, deadline, instructions, JSON.stringify(items || []), invitedSuppliers || []]
    )

    return { document: doc, rfq }
  })

  res.status(201).json(result)
}))

router.get('/rfq', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, d.document_number, d.status, d.created_at,
            (SELECT COUNT(*) FROM supplier_quotes sq WHERE sq.rfq_id=r.id) AS quote_count
     FROM rfq r JOIN documents d ON r.document_id=d.id
     WHERE r.company_id=$1 AND d.status!='deleted' ORDER BY d.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.get('/rfq/:id/quotes', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM supplier_quotes WHERE rfq_id=$1 ORDER BY total_amount ASC',
    [req.params.id]
  )
  res.json(rows)
}))

// ---- BID ANALYSIS ----

router.post('/bid-analysis', ...guard, asyncHandler(async (req, res) => {
  const { rfqId, criteria, scores, recommendedSupplierId, recommendedQuoteId, committeeNotes } = req.body

  const { rows: [ba] } = await query(
    `INSERT INTO bid_analysis (rfq_id, company_id, created_by, criteria, scores, recommended_supplier_id, recommended_quote_id, committee_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [rfqId, req.user.companyId, req.user.id, JSON.stringify(criteria || []), JSON.stringify(scores || []), recommendedSupplierId, recommendedQuoteId, committeeNotes]
  )
  res.status(201).json(ba)
}))

router.put('/bid-analysis/:id/override', ...guard, asyncHandler(async (req, res) => {
  const { overrideSupplierId, justification } = req.body
  if (!justification) return res.status(400).json({ error: 'Justification required for override' })
  const { rows: [ba] } = await query(
    `UPDATE bid_analysis SET override_supplier_id=$1, override_justification=$2, status='reviewed'
     WHERE id=$3 AND company_id=$4 RETURNING *`,
    [overrideSupplierId, justification, req.params.id, req.user.companyId]
  )
  res.json(ba)
}))

// ---- PURCHASE ORDERS (LPO) ----

router.post('/orders', ...guard, asyncHandler(async (req, res) => {
  const { prId, rfqId, bidAnalysisId, supplierId, supplierQuoteId, deliveryAddress, deliveryDate, paymentTerms, currency, items, steps, ccUsers } = req.body

  const subtotal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0)
  const taxAmount = req.body.taxAmount || 0
  const totalAmount = subtotal + taxAmount

  const result = await transaction(async (client) => {
    const doc = await createWorkflow({
      companyId: req.user.companyId, documentType: 'purchase_order',
      title: `Local Purchase Order`, createdBy: req.user.id,
      steps, ccUsers, client,
    })

    const { rows: [po] } = await client.query(
      `INSERT INTO purchase_orders (document_id, pr_id, rfq_id, bid_analysis_id, company_id, created_by, supplier_id, supplier_quote_id, delivery_address, delivery_date, payment_terms, currency, subtotal, tax_amount, total_amount, items)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [doc.id, prId, rfqId, bidAnalysisId, req.user.companyId, req.user.id, supplierId, supplierQuoteId, deliveryAddress, deliveryDate, paymentTerms, currency || 'KES', subtotal, taxAmount, totalAmount, JSON.stringify(items)]
    )

    return { document: doc, order: po }
  })

  res.status(201).json(result)
}))

router.get('/orders', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT po.*, d.document_number, d.status, d.created_at, s.name AS supplier_name
     FROM purchase_orders po JOIN documents d ON po.document_id=d.id
     LEFT JOIN suppliers s ON po.supplier_id=s.id
     WHERE po.company_id=$1 AND d.status!='deleted' ORDER BY d.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

// ---- DELIVERY & INSPECTION ----

router.post('/orders/:orderId/delivery', ...guard, asyncHandler(async (req, res) => {
  const { receivedDate, itemsReceived, inspectionStatus, inspectionNotes } = req.body

  const { rows: [insp] } = await query(
    `INSERT INTO delivery_inspections (po_id, company_id, inspected_by, received_date, items_received, inspection_status, inspection_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.orderId, req.user.companyId, req.user.id, receivedDate, JSON.stringify(itemsReceived || []), inspectionStatus || 'passed', inspectionNotes]
  )

  await query(
    `UPDATE purchase_orders SET delivery_status=$1 WHERE id=$2`,
    [inspectionStatus === 'passed' ? 'inspected' : inspectionStatus === 'partial' ? 'partial' : 'rejected', req.params.orderId]
  )

  res.status(201).json(insp)
}))

// ---- PAYMENT REQUISITIONS ----

router.get('/payments', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT pr.*, d.document_number, d.status, d.created_at, d.title,
            u.first_name || ' ' || u.last_name AS requestor_name
     FROM payment_requisitions pr
     JOIN documents d ON pr.document_id = d.id
     JOIN users u ON pr.created_by = u.id
     WHERE pr.company_id=$1 AND d.status != 'deleted'
     ORDER BY d.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.get('/payments/by-document/:documentId', ...guard, asyncHandler(async (req, res) => {
  const { rows: [pr] } = await query(
    `SELECT pr.*, d.document_number, d.status, d.created_at
     FROM payment_requisitions pr
     JOIN documents d ON pr.document_id = d.id
     WHERE pr.document_id=$1 AND pr.company_id=$2`,
    [req.params.documentId, req.user.companyId]
  )
  if (!pr) return res.status(404).json({ error: 'Not found' })
  res.json(pr)
}))

router.get('/orders/:orderId', ...guard, asyncHandler(async (req, res) => {
  const { rows: [po] } = await query(
    `SELECT po.*, d.document_number, d.status, s.name AS supplier_name_resolved,
            s.bank_details, s.email AS supplier_email
     FROM purchase_orders po
     JOIN documents d ON po.document_id = d.id
     LEFT JOIN suppliers s ON po.supplier_id = s.id
     WHERE po.id=$1 AND po.company_id=$2`,
    [req.params.orderId, req.user.companyId]
  )
  if (!po) return res.status(404).json({ error: 'Not found' })
  res.json(po)
}))

router.post('/payments', ...guard, asyncHandler(async (req, res) => {
  const { poId, payeeName, payeeAccount, payeeBank, currency, amount, paymentMethod, paymentPurpose, budgetLine, steps, ccUsers } = req.body

  let poReference = null
  if (poId) {
    const { rows: [po] } = await query(
      'SELECT d.document_number FROM purchase_orders po JOIN documents d ON po.document_id=d.id WHERE po.id=$1',
      [poId]
    )
    poReference = po?.document_number || null
  }

  const result = await transaction(async (client) => {
    const doc = await createWorkflow({
      companyId: req.user.companyId, documentType: 'payment_requisition',
      title: `Payment Requisition — ${payeeName}`, createdBy: req.user.id,
      steps, ccUsers, client,
      metadata: {
        payeeName, payeeAccount, payeeBank,
        currency: currency || 'KES', amount,
        paymentMethod, paymentPurpose, budgetLine,
        poReference,
      },
    })

    const { rows: [pmtReq] } = await client.query(
      `INSERT INTO payment_requisitions (document_id, po_id, company_id, created_by, payee_name, payee_account, payee_bank, currency, amount, payment_method, payment_purpose, budget_line)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [doc.id, poId || null, req.user.companyId, req.user.id, payeeName, payeeAccount, payeeBank, currency || 'KES', amount, paymentMethod, paymentPurpose, budgetLine]
    )

    return { document: doc, paymentRequisition: pmtReq }
  })

  res.status(201).json(result)
}))

router.put('/payments/:id/voucher', ...guard, asyncHandler(async (req, res) => {
  const { paymentVoucherNumber, paymentDate } = req.body
  const { rows: [pmtReq] } = await query(
    `UPDATE payment_requisitions SET payment_voucher_number=$1, payment_date=$2
     WHERE id=$3 AND company_id=$4 RETURNING *`,
    [paymentVoucherNumber, paymentDate, req.params.id, req.user.companyId]
  )
  if (!pmtReq) return res.status(404).json({ error: 'Not found' })

  await query(
    `UPDATE documents SET status='completed', completed_at=NOW() WHERE id=$1`,
    [pmtReq.document_id]
  )

  res.json(pmtReq)
}))

// ---- SUPPLIERS ----

router.get('/suppliers', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM suppliers WHERE company_id=$1 AND is_active=true ORDER BY name',
    [req.user.companyId]
  )
  res.json(rows)
}))

router.post('/suppliers', ...guard, asyncHandler(async (req, res) => {
  const { name, email, phone, address, contactPerson, taxNumber, bankDetails, category } = req.body
  const { rows: [s] } = await query(
    `INSERT INTO suppliers (company_id, name, email, phone, address, contact_person, tax_number, bank_details, category, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.user.companyId, name, email, phone, address, contactPerson, taxNumber, JSON.stringify(bankDetails || {}), category, req.user.id]
  )
  res.status(201).json(s)
}))

module.exports = router
