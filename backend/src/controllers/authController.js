const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { query, transaction } = require('../config/database')
const { sendEmail } = require('../config/email')
const { uploadFile } = require('../config/storage')
const { auditLog } = require('../middleware/audit')

const generateTokens = (userId, companyId) => {
  const accessToken = jwt.sign(
    { userId, companyId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  )
  const refreshToken = jwt.sign(
    { userId, companyId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  )
  return { accessToken, refreshToken }
}

exports.login = async (req, res) => {
  const { email, password, companyId } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  const { rows: users } = await query(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email.toLowerCase().trim()]
  )

  if (users.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const user = users[0]
  const validPassword = await bcrypt.compare(password, user.password_hash)
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  // Fetch user's companies
  const { rows: companies } = await query(
    `SELECT uc.*, c.name AS company_name, c.domain, c.logo_url, r.name AS role_name, r.display_name AS role_display
     FROM user_companies uc
     JOIN companies c ON uc.company_id = c.id
     JOIN roles r ON uc.role_id = r.id
     WHERE uc.user_id = $1 AND uc.status = 'active' AND c.is_active = true`,
    [user.id]
  )

  let activeCompanyId = companyId
  if (!activeCompanyId && companies.length > 0) {
    const primary = companies.find(c => c.is_primary)
    activeCompanyId = primary ? primary.company_id : companies[0].company_id
  }

  if (!user.is_global_admin && companies.length === 0) {
    return res.status(403).json({ error: 'No active company membership found' })
  }

  const { accessToken, refreshToken } = generateTokens(user.id, activeCompanyId)

  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at, company_id)
     VALUES ($1, $2, NOW() + INTERVAL '7 days', $3)`,
    [user.id, refreshToken, activeCompanyId]
  )

  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id])

  auditLog({ userId: user.id, companyId: activeCompanyId, action: 'LOGIN', req })

  const { password_hash, ...safeUser } = user
  res.json({
    user: safeUser,
    companies,
    activeCompanyId,
    accessToken,
    refreshToken,
  })
}

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' })

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)

  const { rows } = await query(
    'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [refreshToken]
  )
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid or expired refresh token' })

  await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken])

  const { accessToken, refreshToken: newRefresh } = generateTokens(decoded.userId, decoded.companyId)
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at, company_id)
     VALUES ($1, $2, NOW() + INTERVAL '7 days', $3)`,
    [decoded.userId, newRefresh, decoded.companyId]
  )

  res.json({ accessToken, refreshToken: newRefresh })
}

exports.logout = async (req, res) => {
  const { refreshToken } = req.body
  if (refreshToken) {
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken])
  }
  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'LOGOUT', req })
  res.json({ message: 'Logged out successfully' })
}

exports.getMe = async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.job_title,
            u.avatar_url, u.signature_url, u.signature_type, u.timezone,
            u.is_global_admin, u.last_login, u.created_at
     FROM users u WHERE u.id = $1`,
    [req.user.id]
  )

  const { rows: companies } = await query(
    `SELECT uc.company_id, uc.role_id, uc.is_primary, c.name AS company_name,
            c.domain, c.logo_url, c.currency, r.name AS role_name, r.display_name AS role_display
     FROM user_companies uc
     JOIN companies c ON uc.company_id = c.id
     JOIN roles r ON uc.role_id = r.id
     WHERE uc.user_id = $1 AND uc.status = 'active'`,
    [req.user.id]
  )

  const { rows: modules } = await query(
    `SELECT DISTINCT m.code, m.name, m.icon FROM modules m
     WHERE m.id IN (
       SELECT rma.module_id FROM role_module_access rma
       JOIN user_companies uc ON rma.role_id = uc.role_id
       WHERE uc.user_id = $1 AND uc.company_id = $2 AND uc.status = 'active'
       UNION
       SELECT uma.module_id FROM user_module_access uma
       WHERE uma.user_id = $1 AND uma.company_id = $2
     )`,
    [req.user.id, req.user.companyId]
  )

  res.json({ user: rows[0], companies, accessibleModules: modules })
}

exports.updateProfile = async (req, res) => {
  const { firstName, lastName, phone, jobTitle, timezone } = req.body
  const { rows } = await query(
    `UPDATE users SET first_name=$1, last_name=$2, phone=$3, job_title=$4, timezone=$5, updated_at=NOW()
     WHERE id=$6 RETURNING id, email, first_name, last_name, phone, job_title, timezone`,
    [firstName, lastName, phone, jobTitle, timezone, req.user.id]
  )
  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'UPDATE_PROFILE', entityType: 'user', entityId: req.user.id, req })
  res.json(rows[0])
}

exports.saveSignature = async (req, res) => {
  const { signatureData, signatureType, typedName } = req.body
  if (!signatureData || !signatureType) {
    return res.status(400).json({ error: 'Signature data and type required' })
  }

  let signatureUrl = signatureData
  if (signatureType === 'drawn' || signatureType === 'uploaded') {
    const buffer = Buffer.from(signatureData.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    signatureUrl = await uploadFile(buffer, 'signature.png', `signatures/${req.user.id}`)
  }

  await query(
    'UPDATE users SET signature_url=$1, signature_type=$2, updated_at=NOW() WHERE id=$3',
    [signatureUrl, signatureType, req.user.id]
  )
  res.json({ signatureUrl, signatureType })
}

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash)
  if (!valid) return res.status(400).json({ error: 'Current password incorrect' })

  const hash = await bcrypt.hash(newPassword, 12)
  await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id])
  auditLog({ userId: req.user.id, companyId: req.user.companyId, action: 'CHANGE_PASSWORD', req })
  res.json({ message: 'Password changed successfully' })
}

exports.forgotPassword = async (req, res) => {
  const { email } = req.body
  const { rows } = await query('SELECT id, first_name FROM users WHERE email=$1 AND is_active=true', [email])
  if (rows.length === 0) return res.json({ message: 'If that email exists, a reset link has been sent' })

  const token = uuidv4()
  await query(
    'UPDATE users SET password_reset_token=$1, password_reset_expires=NOW()+INTERVAL \'1 hour\' WHERE id=$2',
    [token, rows[0].id]
  )

  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`
  await sendEmail({
    to: email,
    subject: 'Password Reset Request — ERP System',
    html: `<p>Hello ${rows[0].first_name},</p><p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
  })

  res.json({ message: 'If that email exists, a reset link has been sent' })
}

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body
  const { rows } = await query(
    'SELECT id FROM users WHERE password_reset_token=$1 AND password_reset_expires > NOW()',
    [token]
  )
  if (rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset token' })

  const hash = await bcrypt.hash(newPassword, 12)
  await query(
    'UPDATE users SET password_hash=$1, password_reset_token=NULL, password_reset_expires=NULL WHERE id=$2',
    [hash, rows[0].id]
  )
  res.json({ message: 'Password reset successfully' })
}

exports.switchCompany = async (req, res) => {
  const { companyId } = req.body
  const { rows } = await query(
    `SELECT uc.*, c.name AS company_name, r.name AS role_name
     FROM user_companies uc JOIN companies c ON uc.company_id=c.id JOIN roles r ON uc.role_id=r.id
     WHERE uc.user_id=$1 AND uc.company_id=$2 AND uc.status='active'`,
    [req.user.id, companyId]
  )
  if (rows.length === 0) return res.status(403).json({ error: 'Not a member of that company' })

  const { accessToken, refreshToken } = generateTokens(req.user.id, companyId)
  res.json({ accessToken, refreshToken, company: rows[0] })
}
