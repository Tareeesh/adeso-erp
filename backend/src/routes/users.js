const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { authenticate, requireGlobalAdmin, requireRole } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { query } = require('../config/database')
const { sendEmail } = require('../config/email')

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.job_title, u.is_active, u.last_login, u.created_at,
            uc.role_id, r.name AS role_name, r.display_name AS role_display, uc.status AS membership_status
     FROM users u
     LEFT JOIN user_companies uc ON u.id=uc.user_id AND uc.company_id=$1
     LEFT JOIN roles r ON uc.role_id=r.id
     WHERE uc.company_id=$1
     ORDER BY u.first_name`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.post('/', authenticate, requireRole('company_admin', 'global_admin'), asyncHandler(async (req, res) => {
  const { email, firstName, lastName, phone, jobTitle, roleId, timezone } = req.body

  const tempPassword = Math.random().toString(36).slice(-8) + 'A1!'
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  let user
  const { rows: existing } = await query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()])

  if (existing.length > 0) {
    user = existing[0]
  } else {
    const { rows: [newUser] } = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, job_title, timezone)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [email.toLowerCase(), passwordHash, firstName, lastName, phone, jobTitle, timezone || 'Africa/Nairobi']
    )
    user = newUser
  }

  const { rows: [uc] } = await query(
    `INSERT INTO user_companies (user_id, company_id, role_id, status, approved_by, approved_at)
     VALUES ($1,$2,$3,'active',$4,NOW())
     ON CONFLICT (user_id, company_id) DO UPDATE SET role_id=$3, status='active' RETURNING *`,
    [user.id, req.user.companyId, roleId, req.user.id]
  )

  await sendEmail({
    to: email,
    subject: 'Your ERP System Account',
    html: `<p>Hello ${firstName},</p><p>Your account has been created.</p><p><strong>Email:</strong> ${email}<br><strong>Temporary Password:</strong> ${tempPassword}</p><p>Please login and change your password immediately at <a href="${process.env.APP_URL}/login">${process.env.APP_URL}</a></p>`,
  })

  res.status(201).json({ user, membership: uc })
}))

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rows: [user] } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.job_title, u.avatar_url, u.timezone, u.is_active, u.created_at
     FROM users u WHERE u.id=$1`,
    [req.params.id]
  )
  if (!user) return res.status(404).json({ error: 'Not found' })
  res.json(user)
}))

router.put('/:id/role', authenticate, requireRole('company_admin', 'global_admin'), asyncHandler(async (req, res) => {
  const { roleId } = req.body
  const { rows: [uc] } = await query(
    'UPDATE user_companies SET role_id=$1 WHERE user_id=$2 AND company_id=$3 RETURNING *',
    [roleId, req.params.id, req.user.companyId]
  )
  res.json(uc)
}))

router.put('/:id/modules', authenticate, requireRole('company_admin', 'global_admin'), asyncHandler(async (req, res) => {
  const { moduleIds, action } = req.body // action: 'grant' | 'revoke'

  if (action === 'grant') {
    for (const moduleId of moduleIds) {
      await query(
        `INSERT INTO user_module_access (user_id, company_id, module_id, granted_by)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [req.params.id, req.user.companyId, moduleId, req.user.id]
      )
    }
  } else {
    await query(
      'DELETE FROM user_module_access WHERE user_id=$1 AND company_id=$2 AND module_id=ANY($3)',
      [req.params.id, req.user.companyId, moduleIds]
    )
  }

  res.json({ message: `Modules ${action}ed successfully` })
}))

router.put('/:id/status', authenticate, requireRole('company_admin', 'global_admin'), asyncHandler(async (req, res) => {
  const { isActive } = req.body
  await query('UPDATE users SET is_active=$1 WHERE id=$2', [isActive, req.params.id])
  res.json({ message: `User ${isActive ? 'activated' : 'deactivated'}` })
}))

// Approve cross-company membership
router.put('/memberships/:membershipId/approve', authenticate, requireRole('company_admin', 'global_admin'), asyncHandler(async (req, res) => {
  const { rows: [uc] } = await query(
    `UPDATE user_companies SET status='active', approved_by=$1, approved_at=NOW()
     WHERE id=$2 AND company_id=$3 RETURNING *`,
    [req.user.id, req.params.membershipId, req.user.companyId]
  )
  res.json(uc)
}))

module.exports = router
