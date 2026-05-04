const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const sendEmail = async ({ to, cc, subject, html, attachments = [] }) => {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
    attachments,
  }

  if (cc && cc.length > 0) {
    mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc
  }

  const info = await transporter.sendMail(mailOptions)
  return info
}

const verifyConnection = async () => {
  return transporter.verify()
}

module.exports = { sendEmail, verifyConnection }
