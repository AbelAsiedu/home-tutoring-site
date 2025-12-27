// Email service configuration
const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  // Production: Use SendGrid, AWS SES, or other email service
  if (process.env.EMAIL_SERVICE === 'sendgrid' && process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransporter({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }
  
  // Production: SMTP configuration
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  
  // Development: Use console logging (no actual emails sent)
  return {
    sendMail: async (mailOptions) => {
      console.log('📧 Email (Development Mode - Not Sent):');
      console.log('To:', mailOptions.to);
      console.log('Subject:', mailOptions.subject);
      console.log('Text:', mailOptions.text);
      console.log('HTML:', mailOptions.html);
      return { messageId: 'dev-' + Date.now() };
    }
  };
};

const transporter = createTransporter();

// Email templates
const emailTemplates = {
  verification: (name, verificationUrl) => ({
    subject: 'Verify Your Email - Modern Pedagogues',
    text: `Hi ${name},\n\nPlease verify your email by clicking the link below:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nThank you,\nModern Pedagogues Team`,
    html: `
      <h2>Welcome to Modern Pedagogues!</h2>
      <p>Hi ${name},</p>
      <p>Please verify your email address by clicking the button below:</p>
      <p><a href="${verificationUrl}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p>${verificationUrl}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, please ignore this email.</p>
      <p>Thank you,<br>Modern Pedagogues Team</p>
    `
  }),
  
  passwordReset: (name, resetUrl) => ({
    subject: 'Reset Your Password - Modern Pedagogues',
    text: `Hi ${name},\n\nYou requested to reset your password. Click the link below:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nThank you,\nModern Pedagogues Team`,
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>You requested to reset your password. Click the button below:</p>
      <p><a href="${resetUrl}" style="background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p>${resetUrl}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Thank you,<br>Modern Pedagogues Team</p>
    `
  }),
  
  orderConfirmation: (name, orderId, total, items) => ({
    subject: 'Order Confirmation - Modern Pedagogues',
    text: `Hi ${name},\n\nThank you for your order!\n\nOrder ID: ${orderId}\nTotal: $${total}\n\nItems:\n${items.map(i => `- ${i.title} (${i.qty}x) - $${i.price}`).join('\n')}\n\nThank you,\nModern Pedagogues Team`,
    html: `
      <h2>Order Confirmation</h2>
      <p>Hi ${name},</p>
      <p>Thank you for your order!</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Total:</strong> $${total}</p>
      <h3>Items:</h3>
      <ul>
        ${items.map(i => `<li>${i.title} (${i.qty}x) - $${i.price}</li>`).join('')}
      </ul>
      <p>Thank you,<br>Modern Pedagogues Team</p>
    `
  }),
  
  welcomeTutor: (name, email, password, loginUrl) => ({
    subject: 'Welcome to Modern Pedagogues - Tutor Account Created',
    text: `Hi ${name},\n\nAn administrator has created a tutor account for you on Modern Pedagogues.\n\nEmail: ${email}\nTemporary Password: ${password}\n\nLogin here: ${loginUrl}\n\nPlease change your password after logging in.\n\nThank you,\nModern Pedagogues Team`,
    html: `
      <h2>Welcome to Modern Pedagogues!</h2>
      <p>Hi ${name},</p>
      <p>An administrator has created a tutor account for you.</p>
      <p><strong>Login Credentials:</strong></p>
      <p>Email: ${email}<br>Temporary Password: ${password}</p>
      <p><a href="${loginUrl}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now</a></p>
      <p>Please change your password after logging in for security.</p>
      <p>Thank you,<br>Modern Pedagogues Team</p>
    `
  }),
  
  welcomeStudent: (name, email, password, loginUrl) => ({
    subject: 'Welcome to Modern Pedagogues - Student Account Created',
    text: `Hi ${name},\n\nAn administrator has created a student account for you on Modern Pedagogues.\n\nEmail: ${email}\nTemporary Password: ${password}\n\nLogin here: ${loginUrl}\n\nPlease change your password after logging in.\n\nThank you,\nModern Pedagogues Team`,
    html: `
      <h2>Welcome to Modern Pedagogues!</h2>
      <p>Hi ${name},</p>
      <p>An administrator has created a student account for you.</p>
      <p><strong>Login Credentials:</strong></p>
      <p>Email: ${email}<br>Temporary Password: ${password}</p>
      <p><a href="${loginUrl}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now</a></p>
      <p>Please change your password after logging in for security.</p>
      <p>Thank you,<br>Modern Pedagogues Team</p>
    `
  })
};

// Send email function
const sendEmail = async (to, templateName, templateData) => {
  const template = emailTemplates[templateName];
  if (!template) {
    throw new Error(`Email template '${templateName}' not found`);
  }
  
  const emailContent = typeof template === 'function' 
    ? template(...(Array.isArray(templateData) ? templateData : [templateData]))
    : template;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@modernpedagogues.com',
    to,
    ...emailContent
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

module.exports = { sendEmail, emailTemplates };
