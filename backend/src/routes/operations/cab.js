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
    `SELECT cr.*, d.document_number, d.status, d.created_at,
            u.first_name || ' ' || u.last_name AS requestor_name
     FROM cab_requests cr
     JOIN documents d ON cr.document_id=d.id
     JOIN users u ON cr.requestor_id=u.id
     WHERE cr.company_id=$1 AND d.status!='deleted' ORDER BY d.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.post('/', ...guard, asyncHandler(async (req, res) => {
  const { pickupLocation, dropoffLocation, pickupDatetime, returnDatetime, purpose, passengers, passengerNames, specialRequirements, lineManagerId, operationsUserId, steps: customSteps } = req.body

  const steps = (customSteps && customSteps.length > 0) ? customSteps : [
    { name: 'Line Manager Approval', type: 'approval', userId: lineManagerId },
    { name: 'Operations/Logistics Approval', type: 'approval', userId: operationsUserId },
  ].filter(s => s.userId)

  const result = await transaction(async (client) => {
    const doc = await createWorkflow({
      companyId: req.user.companyId, documentType: 'cab_request',
      title: `Cab Request — ${pickupLocation} to ${dropoffLocation}`,
      createdBy: req.user.id, steps, client,
    })

    const { rows: [cr] } = await client.query(
      `INSERT INTO cab_requests (document_id, company_id, requestor_id, pickup_location, dropoff_location, pickup_datetime, return_datetime, purpose, passengers, passenger_names, special_requirements)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [doc.id, req.user.companyId, req.user.id, pickupLocation, dropoffLocation, pickupDatetime, returnDatetime, purpose, passengers || 1, JSON.stringify(passengerNames || []), specialRequirements]
    )

    return { document: doc, cabRequest: cr }
  })

  res.status(201).json(result)
}))

router.put('/:id/assign', ...guard, asyncHandler(async (req, res) => {
  const { assignedVehicle, assignedDriver } = req.body
  const { rows: [cr] } = await query(
    `UPDATE cab_requests SET assigned_vehicle=$1, assigned_driver=$2 WHERE id=$3 AND company_id=$4 RETURNING *`,
    [assignedVehicle, assignedDriver, req.params.id, req.user.companyId]
  )
  if (!cr) return res.status(404).json({ error: 'Not found' })
  res.json(cr)
}))

module.exports = router
