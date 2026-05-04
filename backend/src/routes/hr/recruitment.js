const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { requireModule } = require('../../middleware/rbac')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query, transaction } = require('../../config/database')
const { createWorkflow } = require('../../services/workflowEngine')
const { upload } = require('../../middleware/upload')
const { uploadFile } = require('../../config/storage')

const guard = [authenticate, requireModule('hr')]

// Recruitment Requests
router.get('/requests', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT rr.*, d.document_number, d.status, d.created_at,
            u.first_name || ' ' || u.last_name AS requested_by_name,
            dep.name AS department_name
     FROM recruitment_requests rr
     JOIN documents d ON rr.document_id=d.id
     JOIN users u ON rr.requested_by=u.id
     LEFT JOIN departments dep ON rr.department_id=dep.id
     WHERE rr.company_id=$1 AND d.status!='deleted' ORDER BY d.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.post('/requests', ...guard, asyncHandler(async (req, res) => {
  const { positionTitle, positionCount, departmentId, employmentType, justification, urgency, salaryRangeMin, salaryRangeMax, currency, requiredSkills, requiredQualifications, jobDescription, targetStartDate, steps, ccUsers, hrManagerId, budgetApproverId } = req.body

  const workflowSteps = steps || [
    { name: 'HR Approval', type: 'approval', userId: hrManagerId },
    { name: 'Budget Approval', type: 'approval', userId: budgetApproverId },
  ].filter(s => s.userId)

  const result = await transaction(async (client) => {
    const doc = await createWorkflow({
      companyId: req.user.companyId, documentType: 'recruitment_request',
      title: `Recruitment Request — ${positionTitle}`, createdBy: req.user.id,
      steps: workflowSteps, ccUsers, client,
    })

    const { rows: [rr] } = await client.query(
      `INSERT INTO recruitment_requests (document_id, company_id, requested_by, department_id, position_title, position_count, employment_type, justification, urgency, salary_range_min, salary_range_max, currency, required_skills, required_qualifications, job_description, target_start_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [doc.id, req.user.companyId, req.user.id, departmentId, positionTitle, positionCount || 1, employmentType, justification, urgency || 'normal', salaryRangeMin, salaryRangeMax, currency || 'KES', JSON.stringify(requiredSkills || []), requiredQualifications, jobDescription, targetStartDate]
    )

    return { document: doc, recruitmentRequest: rr }
  })

  res.status(201).json(result)
}))

// Job Postings
router.post('/postings', ...guard, asyncHandler(async (req, res) => {
  const { recruitmentRequestId, title, description, postingType, platforms, applicationDeadline } = req.body
  const { rows: [jp] } = await query(
    `INSERT INTO job_postings (recruitment_request_id, company_id, posted_by, title, description, posting_type, platforms, application_deadline)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [recruitmentRequestId, req.user.companyId, req.user.id, title, description, postingType || 'both', JSON.stringify(platforms || []), applicationDeadline]
  )
  res.status(201).json(jp)
}))

router.get('/postings', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT jp.*, (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_posting_id=jp.id) AS application_count
     FROM job_postings jp WHERE jp.company_id=$1 ORDER BY jp.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

// Applications
router.get('/postings/:postingId/applications', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM job_applications WHERE job_posting_id=$1 ORDER BY created_at DESC',
    [req.params.postingId]
  )
  res.json(rows)
}))

router.post('/postings/:postingId/applications', upload.single('resume'), asyncHandler(async (req, res) => {
  let resumeUrl = null
  if (req.file) {
    resumeUrl = await uploadFile(req.file.buffer, req.file.originalname, 'resumes')
  }
  const { applicantName, applicantEmail, applicantPhone, coverLetter, source } = req.body
  const { rows: [app] } = await query(
    `INSERT INTO job_applications (job_posting_id, company_id, applicant_name, applicant_email, applicant_phone, resume_url, cover_letter, source)
     VALUES ($1,(SELECT company_id FROM job_postings WHERE id=$1),$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.postingId, applicantName, applicantEmail, applicantPhone, resumeUrl, coverLetter, source]
  )
  res.status(201).json(app)
}))

router.put('/applications/:id/status', ...guard, asyncHandler(async (req, res) => {
  const { status, notes, score } = req.body
  const { rows: [app] } = await query(
    `UPDATE job_applications SET status=$1, notes=$2, score=$3, updated_at=NOW()
     WHERE id=$4 RETURNING *`,
    [status, notes, score, req.params.id]
  )
  res.json(app)
}))

// Interviews
router.post('/interviews', ...guard, asyncHandler(async (req, res) => {
  const { applicationId, interviewType, scheduledAt, durationMinutes, location, interviewers } = req.body
  const { rows: [interview] } = await query(
    `INSERT INTO interviews (application_id, company_id, scheduled_by, interview_type, scheduled_at, duration_minutes, location, interviewers)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [applicationId, req.user.companyId, req.user.id, interviewType, scheduledAt, durationMinutes || 60, location, JSON.stringify(interviewers || [])]
  )
  res.status(201).json(interview)
}))

router.put('/interviews/:id/feedback', ...guard, asyncHandler(async (req, res) => {
  const { feedback, overallScore, recommendation } = req.body
  const { rows: [interview] } = await query(
    `UPDATE interviews SET feedback=$1, overall_score=$2, recommendation=$3, status='completed'
     WHERE id=$4 RETURNING *`,
    [JSON.stringify(feedback), overallScore, recommendation, req.params.id]
  )
  res.json(interview)
}))

// Offer Letters
router.post('/offers', ...guard, asyncHandler(async (req, res) => {
  const { applicationId, candidateName, candidateEmail, positionTitle, department, startDate, salary, currency, employmentType, probationMonths, additionalTerms, steps, ccUsers } = req.body

  const result = await transaction(async (client) => {
    const doc = await createWorkflow({
      companyId: req.user.companyId, documentType: 'offer_letter',
      title: `Offer Letter — ${candidateName} (${positionTitle})`,
      createdBy: req.user.id, steps: steps || [], ccUsers, client,
    })

    const { rows: [offer] } = await client.query(
      `INSERT INTO offer_letters (document_id, application_id, company_id, created_by, candidate_name, candidate_email, position_title, department, start_date, salary, currency, employment_type, probation_months, additional_terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [doc.id, applicationId, req.user.companyId, req.user.id, candidateName, candidateEmail, positionTitle, department, startDate, salary, currency || 'KES', employmentType, probationMonths || 3, additionalTerms]
    )

    return { document: doc, offer }
  })

  res.status(201).json(result)
}))

router.put('/offers/:id/response', asyncHandler(async (req, res) => {
  const { acceptanceStatus } = req.body
  const { rows: [offer] } = await query(
    `UPDATE offer_letters SET acceptance_status=$1, accepted_at=${acceptanceStatus === 'accepted' ? 'NOW()' : 'NULL'}
     WHERE id=$2 RETURNING *`,
    [acceptanceStatus, req.params.id]
  )
  res.json(offer)
}))

// Employees
router.get('/employees', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT e.*, u.first_name, u.last_name, u.email, u.avatar_url,
            dep.name AS department_name,
            m.first_name || ' ' || m.last_name AS manager_name
     FROM employees e
     LEFT JOIN users u ON e.user_id=u.id
     LEFT JOIN departments dep ON e.department_id=dep.id
     LEFT JOIN employees me ON e.line_manager_id=me.id
     LEFT JOIN users m ON me.user_id=m.id
     WHERE e.company_id=$1 AND e.employment_status='active'
     ORDER BY u.first_name`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.post('/employees', ...guard, asyncHandler(async (req, res) => {
  const { userId, employeeNumber, departmentId, jobTitle, employmentType, startDate, lineManagerId, salary, salaryCurrency, workLocation } = req.body
  const { rows: [emp] } = await query(
    `INSERT INTO employees (user_id, company_id, employee_number, department_id, job_title, employment_type, start_date, line_manager_id, salary, salary_currency, work_location)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [userId, req.user.companyId, employeeNumber, departmentId, jobTitle, employmentType, startDate, lineManagerId, salary, salaryCurrency || 'KES', workLocation]
  )
  res.status(201).json(emp)
}))

module.exports = router
