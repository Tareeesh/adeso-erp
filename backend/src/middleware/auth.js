const jwt = require('jsonwebtoken')
const { query } = require('../config/database')

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const { rows } = await query(
      `SELECT u.*, uc.role_id, uc.company_id AS active_company_id, r.name AS role_name, r.permissions
       FROM users u
       LEFT JOIN user_companies uc ON u.id = uc.user_id AND uc.company_id = $2 AND uc.status = 'active'
       LEFT JOIN roles r ON uc.role_id = r.id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId, decoded.companyId]
    )

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' })
    }

    req.user = rows[0]
    req.user.companyId = decoded.companyId || rows[0].active_company_id
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}

const requireGlobalAdmin = (req, res, next) => {
  if (!req.user?.is_global_admin) {
    return res.status(403).json({ error: 'Global admin access required' })
  }
  next()
}

const requireRole = (...roles) => (req, res, next) => {
  if (req.user?.is_global_admin) return next()
  if (!roles.includes(req.user?.role_name)) {
    return res.status(403).json({ error: 'Insufficient role permissions' })
  }
  next()
}

module.exports = { authenticate, requireGlobalAdmin, requireRole }
