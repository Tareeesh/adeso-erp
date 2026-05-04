const { query } = require('../config/database')

const requireModule = (moduleCode) => async (req, res, next) => {
  try {
    if (req.user?.is_global_admin) return next()

    const companyId = req.user.companyId
    const userId = req.user.id

    // Check role-level module access
    const { rows: roleAccess } = await query(
      `SELECT rma.id FROM role_module_access rma
       JOIN modules m ON rma.module_id = m.id
       JOIN user_companies uc ON rma.role_id = uc.role_id
       WHERE uc.user_id = $1 AND uc.company_id = $2
         AND m.code = $3 AND uc.status = 'active'`,
      [userId, companyId, moduleCode]
    )

    if (roleAccess.length > 0) return next()

    // Check per-user override
    const { rows: userAccess } = await query(
      `SELECT uma.id FROM user_module_access uma
       JOIN modules m ON uma.module_id = m.id
       WHERE uma.user_id = $1 AND uma.company_id = $2 AND m.code = $3`,
      [userId, companyId, moduleCode]
    )

    if (userAccess.length > 0) return next()

    return res.status(403).json({ error: `Access to ${moduleCode} module not granted` })
  } catch (err) {
    next(err)
  }
}

module.exports = { requireModule }
