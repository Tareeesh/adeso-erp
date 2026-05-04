const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { requireModule } = require('../../middleware/rbac')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query } = require('../../config/database')

const guard = [authenticate, requireModule('hr')]

router.get('/', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT itr.*, u.first_name || ' ' || u.last_name AS employee_name, e.job_title
     FROM it_account_requests itr
     JOIN employees e ON itr.employee_id=e.id
     LEFT JOIN users u ON e.user_id=u.id
     WHERE itr.company_id=$1 ORDER BY itr.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.put('/:id/assign', ...guard, asyncHandler(async (req, res) => {
  const { assignedTo } = req.body
  const { rows: [itr] } = await query(
    `UPDATE it_account_requests SET assigned_to=$1, status='in_progress' WHERE id=$2 AND company_id=$3 RETURNING *`,
    [assignedTo, req.params.id, req.user.companyId]
  )
  res.json(itr)
}))

router.put('/:id/complete', ...guard, asyncHandler(async (req, res) => {
  const { emailAddress, systemRoles, accessLevel, notes } = req.body
  const { rows: [itr] } = await query(
    `UPDATE it_account_requests SET email_address=$1, system_roles=$2, access_level=$3, notes=$4, status='completed', completed_at=NOW()
     WHERE id=$5 AND company_id=$6 RETURNING *`,
    [emailAddress, JSON.stringify(systemRoles || []), accessLevel, notes, req.params.id, req.user.companyId]
  )

  if (itr?.employee_id && emailAddress) {
    await query(
      `UPDATE users u SET email=$1 FROM employees e WHERE e.id=$2 AND e.user_id=u.id`,
      [emailAddress, itr.employee_id]
    )
  }

  res.json(itr)
}))

module.exports = router
