const { sendEmail } = require('../config/email')
const { query } = require('../config/database')

const templates = {
  workflowAction: ({ recipientName, action, documentTitle, documentNumber, documentType, actionUrl }) => ({
    subject: `Action Required: ${documentType} #${documentNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1d4ed8;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="color:white;margin:0;">ERP System Notification</h2>
        </div>
        <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;">
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>Your action is required on the following document:</p>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Document:</strong> ${documentTitle}</p>
            <p style="margin:4px 0;"><strong>Reference:</strong> ${documentNumber}</p>
            <p style="margin:4px 0;"><strong>Action:</strong> ${action}</p>
          </div>
          <a href="${actionUrl}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            View Document
          </a>
          <p style="color:#64748b;font-size:12px;margin-top:24px;">
            This is an automated notification from ${process.env.APP_NAME || 'ERP System'}.
          </p>
        </div>
      </div>`,
  }),

  workflowCompleted: ({ recipientName, documentTitle, documentNumber, documentType, actionUrl }) => ({
    subject: `Completed: ${documentType} #${documentNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#059669;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="color:white;margin:0;">Document Completed</h2>
        </div>
        <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;">
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>The following document has been completed and signed by all parties:</p>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Document:</strong> ${documentTitle}</p>
            <p style="margin:4px 0;"><strong>Reference:</strong> ${documentNumber}</p>
          </div>
          <a href="${actionUrl}" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            View Completed Document
          </a>
        </div>
      </div>`,
  }),

  workflowRejected: ({ recipientName, documentTitle, documentNumber, rejectedBy, reason, actionUrl }) => ({
    subject: `Rejected: ${documentNumber} — ${documentTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="color:white;margin:0;">Document Rejected</h2>
        </div>
        <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;">
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>Your document has been rejected.</p>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Document:</strong> ${documentTitle}</p>
            <p style="margin:4px 0;"><strong>Reference:</strong> ${documentNumber}</p>
            <p style="margin:4px 0;"><strong>Rejected by:</strong> ${rejectedBy}</p>
            <p style="margin:4px 0;"><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
          </div>
          <p>You may edit and resubmit this document.</p>
          <a href="${actionUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            View Document
          </a>
        </div>
      </div>`,
  }),

  reminderAction: ({ recipientName, documentTitle, documentNumber, daysOverdue, actionUrl }) => ({
    subject: `Reminder (Day ${daysOverdue}): Action Required on ${documentNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#d97706;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="color:white;margin:0;">Action Reminder</h2>
        </div>
        <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;">
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>This is a reminder that the following document has been awaiting your action for <strong>${daysOverdue} day(s)</strong>:</p>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Document:</strong> ${documentTitle}</p>
            <p style="margin:4px 0;"><strong>Reference:</strong> ${documentNumber}</p>
          </div>
          <p style="color:#dc2626;"><strong>Note:</strong> If no action is taken within 30 days, this document will be automatically deleted.</p>
          <a href="${actionUrl}" style="display:inline-block;background:#d97706;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Take Action Now
          </a>
        </div>
      </div>`,
  }),

  supplierRFQ: ({ supplierName, companyName, rfqNumber, deadline, portalLink }) => ({
    subject: `Request for Quotation #${rfqNumber} from ${companyName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1d4ed8;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="color:white;margin:0;">Request for Quotation</h2>
        </div>
        <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;">
          <p>Dear <strong>${supplierName}</strong>,</p>
          <p><strong>${companyName}</strong> invites you to submit a quotation.</p>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>RFQ Reference:</strong> ${rfqNumber}</p>
            <p style="margin:4px 0;"><strong>Submission Deadline:</strong> ${deadline}</p>
          </div>
          <p>Please use the secure link below to submit your quotation. This link is unique to you and will expire once you have submitted your quote.</p>
          <a href="${portalLink}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Submit Quotation
          </a>
          <p style="color:#64748b;font-size:12px;margin-top:16px;">This link is confidential. Do not share it.</p>
        </div>
      </div>`,
  }),

  lowStock: ({ recipientName, itemName, sku, currentQty, reorderLevel, warehouseName }) => ({
    subject: `Low Stock Alert: ${itemName} (${sku})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="color:white;margin:0;">Low Stock Alert</h2>
        </div>
        <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;">
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>The following item has reached its reorder level:</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Item:</strong> ${itemName}</p>
            <p style="margin:4px 0;"><strong>SKU:</strong> ${sku}</p>
            <p style="margin:4px 0;"><strong>Warehouse:</strong> ${warehouseName}</p>
            <p style="margin:4px 0;"><strong>Current Quantity:</strong> ${currentQty}</p>
            <p style="margin:4px 0;"><strong>Reorder Level:</strong> ${reorderLevel}</p>
          </div>
          <p>Please initiate a purchase requisition to replenish stock.</p>
        </div>
      </div>`,
  }),
}

const sendWorkflowNotification = async ({ documentId, stepId, recipientUserId, type, data }) => {
  const { rows } = await query(
    'SELECT email, first_name, last_name FROM users WHERE id=$1',
    [recipientUserId]
  )
  if (rows.length === 0) return

  const user = rows[0]
  const actionUrl = `${process.env.APP_URL}/documents/${documentId}`
  const template = templates[type]({ ...data, recipientName: `${user.first_name} ${user.last_name}`, actionUrl })

  await sendEmail({ to: user.email, ...template })

  await query(
    `INSERT INTO notifications (user_id, company_id, type, title, message, entity_type, entity_id, email_sent)
     VALUES ($1,$2,$3,$4,$5,'document',$6,true)`,
    [recipientUserId, data.companyId, type, template.subject, `Action required on ${data.documentNumber}`, documentId]
  )
}

module.exports = { sendWorkflowNotification, templates }
