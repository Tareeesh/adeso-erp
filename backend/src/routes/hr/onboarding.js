const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { requireModule } = require('../../middleware/rbac')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query, transaction } = require('../../config/database')
const { sendEmail } = require('../../config/email')

const guard = [authenticate, requireModule('hr')]

const DEFAULT_ONBOARDING_TASKS = [
  { name: 'Employee Profile Creation', task_type: 'hr', sort_order: 1 },
  { name: 'Contract Generation & Signing', task_type: 'hr', sort_order: 2 },
  { name: 'IT Account Creation Request', task_type: 'it', sort_order: 3 },
  { name: 'Company Email Setup', task_type: 'it', sort_order: 4 },
  { name: 'Asset Allocation (Laptop/Equipment)', task_type: 'assets', sort_order: 5 },
  { name: 'Access Cards & Building Access', task_type: 'assets', sort_order: 6 },
  { name: 'Induction Scheduling', task_type: 'hr', sort_order: 7 },
  { name: 'Bank Details Collection', task_type: 'hr', sort_order: 8 },
]

router.post('/', ...guard, asyncHandler(async (req, res) => {
  const { employeeId, startDate, targetCompletionDate, customTasks, itAdminId } = req.body

  const result = await transaction(async (client) => {
    const { rows: [onb] } = await client.query(
      `INSERT INTO onboarding_processes (employee_id, company_id, managed_by, start_date, target_completion_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [employeeId, req.user.companyId, req.user.id, startDate, targetCompletionDate]
    )

    const tasks = customTasks || DEFAULT_ONBOARDING_TASKS
    for (const task of tasks) {
      await client.query(
        `INSERT INTO onboarding_tasks (onboarding_id, task_name, task_type, sort_order)
         VALUES ($1,$2,$3,$4)`,
        [onb.id, task.name, task.task_type || 'general', task.sort_order || 0]
      )
    }

    // Auto-trigger IT account request
    if (itAdminId) {
      await client.query(
        `INSERT INTO it_account_requests (onboarding_id, employee_id, company_id, requested_by, assigned_to, request_types, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
        [onb.id, employeeId, req.user.companyId, req.user.id, itAdminId,
         JSON.stringify(['email_creation', 'system_access', 'erp_role_assignment'])]
      )
    }

    return onb
  })

  res.status(201).json(result)
}))

router.get('/', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT op.*, u.first_name || ' ' || u.last_name AS employee_name, e.job_title
     FROM onboarding_processes op
     JOIN employees e ON op.employee_id=e.id
     LEFT JOIN users u ON e.user_id=u.id
     WHERE op.company_id=$1 ORDER BY op.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.get('/:id', ...guard, asyncHandler(async (req, res) => {
  const { rows: [onb] } = await query(
    `SELECT op.*, u.first_name || ' ' || u.last_name AS employee_name, e.job_title
     FROM onboarding_processes op
     JOIN employees e ON op.employee_id=e.id
     LEFT JOIN users u ON e.user_id=u.id
     WHERE op.id=$1 AND op.company_id=$2`,
    [req.params.id, req.user.companyId]
  )
  if (!onb) return res.status(404).json({ error: 'Not found' })

  const { rows: tasks } = await query(
    'SELECT * FROM onboarding_tasks WHERE onboarding_id=$1 ORDER BY sort_order',
    [req.params.id]
  )

  const { rows: itRequests } = await query(
    'SELECT * FROM it_account_requests WHERE onboarding_id=$1',
    [req.params.id]
  )

  const { rows: inductions } = await query(
    'SELECT * FROM induction_checklists WHERE onboarding_id=$1',
    [req.params.id]
  )

  res.json({ ...onb, tasks, itRequests, inductions })
}))

router.put('/:id/tasks/:taskId', ...guard, asyncHandler(async (req, res) => {
  const { status, notes } = req.body
  const { rows: [task] } = await query(
    `UPDATE onboarding_tasks SET status=$1, notes=$2, completed_at=${status === 'completed' ? 'NOW()' : 'NULL'}, completed_by=${status === 'completed' ? '$4' : 'NULL'}
     WHERE id=$3 RETURNING *`,
    status === 'completed'
      ? [status, notes, req.params.taskId, req.user.id]
      : [status, notes, req.params.taskId]
  )

  // Check if all tasks completed
  const { rows: allTasks } = await query(
    'SELECT status FROM onboarding_tasks WHERE onboarding_id=$1',
    [req.params.id]
  )
  const allDone = allTasks.every(t => t.status === 'completed' || t.status === 'skipped')
  if (allDone) {
    await query(`UPDATE onboarding_processes SET status='completed', completed_at=NOW() WHERE id=$1`, [req.params.id])
  }

  res.json(task)
}))

// Induction
router.post('/:id/induction', ...guard, asyncHandler(async (req, res) => {
  const { onb } = await query('SELECT employee_id FROM onboarding_processes WHERE id=$1', [req.params.id])
  const { rows: [onboarding] } = await query('SELECT employee_id FROM onboarding_processes WHERE id=$1', [req.params.id])

  const { rows: [checklist] } = await query(
    `INSERT INTO induction_checklists (onboarding_id, employee_id, company_id, assigned_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, onboarding.employee_id, req.user.companyId, req.user.id]
  )

  const inductionItems = req.body.items || [
    { item_name: 'Company Policies & Code of Conduct', category: 'policy' },
    { item_name: 'Health & Safety Briefing', category: 'safety' },
    { item_name: 'Department Orientation', category: 'orientation' },
    { item_name: 'ERP System Training', category: 'training' },
    { item_name: 'IT & Systems Introduction', category: 'training' },
    { item_name: 'Meet the Team', category: 'orientation' },
  ]

  for (let i = 0; i < inductionItems.length; i++) {
    await query(
      `INSERT INTO induction_items (checklist_id, item_name, category, sort_order) VALUES ($1,$2,$3,$4)`,
      [checklist.id, inductionItems[i].item_name, inductionItems[i].category, i + 1]
    )
  }

  const { rows: items } = await query('SELECT * FROM induction_items WHERE checklist_id=$1 ORDER BY sort_order', [checklist.id])
  res.status(201).json({ checklist, items })
}))

router.put('/induction-items/:itemId/complete', authenticate, asyncHandler(async (req, res) => {
  const { acknowledgmentSignature } = req.body
  const { rows: [item] } = await query(
    `UPDATE induction_items SET is_completed=true, completed_at=NOW(), acknowledgment_signature=$1
     WHERE id=$2 RETURNING *`,
    [acknowledgmentSignature, req.params.itemId]
  )
  res.json(item)
}))

module.exports = router
