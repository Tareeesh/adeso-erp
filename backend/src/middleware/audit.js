const { query } = require('../config/database')

const auditLog = async ({ userId, companyId, action, entityType, entityId, oldValues, newValues, req, metadata = {} }) => {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, company_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        userId || null,
        companyId || null,
        action,
        entityType || null,
        entityId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        req?.ip || null,
        req?.headers?.['user-agent'] || null,
        JSON.stringify(metadata),
      ]
    )
  } catch (err) {
    console.error('Audit log error:', err.message)
  }
}

module.exports = { auditLog }
