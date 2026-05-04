const express = require('express')
const router = express.Router()
const { authenticate, requireRole } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { query } = require('../config/database')

router.get('/', authenticate, requireRole('company_admin', 'global_admin'), asyncHandler(async (req, res) => {
  const { entityType, entityId, userId, page = 1, limit = 50 } = req.query
  const offset = (page - 1) * limit
  const conditions = ['al.company_id=$1']
  const params = [req.user.companyId]

  if (entityType) conditions.push(`al.entity_type=$${params.push(entityType)}`)
  if (entityId) conditions.push(`al.entity_id=$${params.push(entityId)}`)
  if (userId) conditions.push(`al.user_id=$${params.push(userId)}`)

  const { rows } = await query(
    `SELECT al.*, u.first_name || ' ' || u.last_name AS user_name, u.email AS user_email
     FROM audit_logs al LEFT JOIN users u ON al.user_id=u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY al.created_at DESC LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`,
    params
  )
  res.json(rows)
}))

module.exports = router
