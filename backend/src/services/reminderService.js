const cron = require('node-cron')
const { query } = require('../config/database')
const { sendEmail } = require('../config/email')
const { templates } = require('./emailService')

const processReminders = async () => {
  try {
    // Find workflow steps that are in_progress or pending and have a document not yet acted on
    const { rows: pendingSteps } = await query(`
      SELECT ws.id AS step_id, ws.document_id, ws.assigned_user_id, ws.reminder_count,
             ws.last_reminder_sent, ws.created_at,
             d.title AS document_title, d.document_number, d.document_type, d.company_id,
             u.email, u.first_name, u.last_name
      FROM workflow_steps ws
      JOIN documents d ON ws.document_id = d.id
      JOIN users u ON ws.assigned_user_id = u.id
      WHERE ws.status = 'in_progress'
        AND d.status NOT IN ('completed','rejected','cancelled','deleted')
        AND ws.reminder_count < 30
        AND (ws.last_reminder_sent IS NULL OR ws.last_reminder_sent < NOW() - INTERVAL '23 hours')
    `)

    for (const step of pendingSteps) {
      const daysWaiting = Math.floor(
        (Date.now() - new Date(step.last_reminder_sent || step.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )

      const template = templates.reminderAction({
        recipientName: `${step.first_name} ${step.last_name}`,
        documentTitle: step.document_title,
        documentNumber: step.document_number,
        daysOverdue: step.reminder_count + 1,
        actionUrl: `${process.env.APP_URL}/documents/${step.document_id}`,
      })

      await sendEmail({ to: step.email, ...template })

      await query(
        `UPDATE workflow_steps SET reminder_count = reminder_count + 1, last_reminder_sent = NOW()
         WHERE id = $1`,
        [step.step_id]
      )
    }

    // Delete documents where reminders have reached 30 (1 month) and notify requestor
    const { rows: expiredDocs } = await query(`
      SELECT DISTINCT d.id, d.document_number, d.document_title, d.created_by,
             u.email, u.first_name
      FROM workflow_steps ws
      JOIN documents d ON ws.document_id = d.id
      JOIN users u ON d.created_by = u.id
      WHERE ws.status = 'in_progress'
        AND ws.reminder_count >= 30
        AND d.status NOT IN ('completed','rejected','cancelled','deleted')
    `)

    for (const doc of expiredDocs) {
      await query(
        `UPDATE documents SET status = 'deleted', deleted_at = NOW() WHERE id = $1`,
        [doc.id]
      )

      await sendEmail({
        to: doc.email,
        subject: `Document Expired: ${doc.document_number}`,
        html: `<p>Hello ${doc.first_name},</p>
               <p>Your document <strong>${doc.document_number}</strong> has been deleted after 30 days of inactivity from the assigned approver.</p>
               <p>Please create a new request if still required.</p>`,
      })
    }

    if (pendingSteps.length > 0 || expiredDocs.length > 0) {
      console.log(`Reminders: sent ${pendingSteps.length}, expired ${expiredDocs.length} documents`)
    }
  } catch (err) {
    console.error('Reminder scheduler error:', err.message)
  }
}

const startReminderScheduler = () => {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', processReminders)
  console.log('Reminder scheduler started (daily at 08:00)')
}

module.exports = { startReminderScheduler, processReminders }
