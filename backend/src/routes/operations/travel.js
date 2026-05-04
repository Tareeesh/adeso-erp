const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { requireModule } = require('../../middleware/rbac')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query, transaction } = require('../../config/database')
const { createWorkflow } = require('../../services/workflowEngine')

const guard = [authenticate, requireModule('operations')]

router.get('/', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ta.*, d.document_number, d.status, d.created_at,
            u.first_name || ' ' || u.last_name AS requestor_name
     FROM travel_authorizations ta
     JOIN documents d ON ta.document_id=d.id
     JOIN users u ON ta.requestor_id=u.id
     WHERE ta.company_id=$1 AND d.status!='deleted' ORDER BY d.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.post('/', ...guard, asyncHandler(async (req, res) => {
  const { travelerName, destination, departureDate, returnDate, purpose, transportationMode, accommodation, estimatedCost, currency, perDiem, advanceRequested, budgetLine, additionalNotes, steps, ccUsers, collaboratingCompanies } = req.body

  const result = await transaction(async (client) => {
    const doc = await createWorkflow({
      companyId: req.user.companyId, documentType: 'travel_authorization',
      title: `Travel Authorization — ${destination}`, createdBy: req.user.id,
      steps, ccUsers, collaboratingCompanies, client,
    })

    const { rows: [ta] } = await client.query(
      `INSERT INTO travel_authorizations (document_id, company_id, requestor_id, traveler_name, destination, departure_date, return_date, purpose, transportation_mode, accommodation, estimated_cost, currency, per_diem, advance_requested, budget_line, additional_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [doc.id, req.user.companyId, req.user.id, travelerName, destination, departureDate, returnDate, purpose, transportationMode, accommodation, estimatedCost, currency || 'KES', perDiem, advanceRequested, budgetLine, additionalNotes]
    )

    return { document: doc, travelAuthorization: ta }
  })

  res.status(201).json(result)
}))

router.get('/:id', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ta.*, d.*, u.first_name || ' ' || u.last_name AS requestor_name
     FROM travel_authorizations ta
     JOIN documents d ON ta.document_id=d.id
     JOIN users u ON ta.requestor_id=u.id
     WHERE ta.id=$1 AND ta.company_id=$2`,
    [req.params.id, req.user.companyId]
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
}))

module.exports = router
