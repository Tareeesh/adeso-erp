const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { requireModule } = require('../../middleware/rbac')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query } = require('../../config/database')

const guard = [authenticate, requireModule('hr')]

router.get('/', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT pr.*, u.first_name || ' ' || u.last_name AS employee_name,
            rv.first_name || ' ' || rv.last_name AS reviewer_name,
            e.job_title
     FROM performance_reviews pr
     JOIN employees e ON pr.employee_id=e.id
     LEFT JOIN users u ON e.user_id=u.id
     LEFT JOIN users rv ON pr.reviewer_id=rv.id
     WHERE pr.company_id=$1 ORDER BY pr.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

// Employee can see their own reviews
router.get('/my-reviews', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT pr.*, rv.first_name || ' ' || rv.last_name AS reviewer_name
     FROM performance_reviews pr
     JOIN employees e ON pr.employee_id=e.id
     LEFT JOIN users rv ON pr.reviewer_id=rv.id
     WHERE e.user_id=$1 ORDER BY pr.created_at DESC`,
    [req.user.id]
  )
  res.json(rows)
}))

router.post('/', ...guard, asyncHandler(async (req, res) => {
  const { employeeId, reviewPeriod, periodStart, periodEnd, kpiScores, goalsNextPeriod } = req.body
  const { rows: [review] } = await query(
    `INSERT INTO performance_reviews (employee_id, reviewer_id, company_id, review_period, period_start, period_end, kpi_scores, goals_next_period, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft') RETURNING *`,
    [employeeId, req.user.id, req.user.companyId, reviewPeriod, periodStart, periodEnd, JSON.stringify(kpiScores || []), JSON.stringify(goalsNextPeriod || [])]
  )
  res.status(201).json(review)
}))

router.put('/:id/self-assessment', authenticate, asyncHandler(async (req, res) => {
  const { selfAssessment } = req.body
  const { rows: [review] } = await query(
    `UPDATE performance_reviews SET self_assessment=$1, status='manager_review'
     WHERE id=$2 RETURNING *`,
    [selfAssessment, req.params.id]
  )
  res.json(review)
}))

router.put('/:id/manager-feedback', ...guard, asyncHandler(async (req, res) => {
  const { managerFeedback, overallRating, promotionEligible, improvementPlan } = req.body
  const { rows: [review] } = await query(
    `UPDATE performance_reviews SET manager_feedback=$1, overall_rating=$2, promotion_eligible=$3, improvement_plan=$4, status='hr_review'
     WHERE id=$5 AND reviewer_id=$6 RETURNING *`,
    [managerFeedback, overallRating, promotionEligible || false, improvementPlan, req.params.id, req.user.id]
  )
  res.json(review)
}))

router.put('/:id/complete', ...guard, asyncHandler(async (req, res) => {
  const { hrComments } = req.body
  const { rows: [review] } = await query(
    `UPDATE performance_reviews SET hr_comments=$1, status='completed', completed_at=NOW()
     WHERE id=$2 AND company_id=$3 RETURNING *`,
    [hrComments, req.params.id, req.user.companyId]
  )
  res.json(review)
}))

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rows: [review] } = await query(
    `SELECT pr.*, u.first_name || ' ' || u.last_name AS employee_name,
            rv.first_name || ' ' || rv.last_name AS reviewer_name
     FROM performance_reviews pr
     JOIN employees e ON pr.employee_id=e.id
     LEFT JOIN users u ON e.user_id=u.id
     LEFT JOIN users rv ON pr.reviewer_id=rv.id
     WHERE pr.id=$1 AND pr.company_id=$2`,
    [req.params.id, req.user.companyId]
  )
  if (!review) return res.status(404).json({ error: 'Not found' })
  res.json(review)
}))

module.exports = router
