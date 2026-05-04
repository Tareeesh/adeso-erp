const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { requireModule } = require('../../middleware/rbac')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query } = require('../../config/database')

const guard = [authenticate, requireModule('hr')]

router.get('/', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ic.*, u.first_name || ' ' || u.last_name AS employee_name,
            (SELECT COUNT(*) FROM induction_items ii WHERE ii.checklist_id=ic.id) AS total_items,
            (SELECT COUNT(*) FROM induction_items ii WHERE ii.checklist_id=ic.id AND ii.is_completed=true) AS completed_items
     FROM induction_checklists ic
     JOIN employees e ON ic.employee_id=e.id
     LEFT JOIN users u ON e.user_id=u.id
     WHERE ic.company_id=$1 ORDER BY ic.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rows: [checklist] } = await query(
    'SELECT * FROM induction_checklists WHERE id=$1 AND company_id=$2',
    [req.params.id, req.user.companyId]
  )
  if (!checklist) return res.status(404).json({ error: 'Not found' })

  const { rows: items } = await query(
    'SELECT * FROM induction_items WHERE checklist_id=$1 ORDER BY sort_order',
    [req.params.id]
  )

  res.json({ checklist, items })
}))

module.exports = router
