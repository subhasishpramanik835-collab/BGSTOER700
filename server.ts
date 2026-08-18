import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Helper to create Nodemailer transporter
  const createTransporter = (smtp: {
    email: string;
    appPassword: string;
    host?: string;
    port?: number;
  }) => {
    const cleanPassword = (smtp.appPassword || '').replace(/\s+/g, '');
    const host = smtp.host || 'smtp.gmail.com';
    const port = Number(smtp.port) || 587;
    const isSecure = port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user: smtp.email,
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  };

  // Test SMTP connection endpoint
  app.post("/api/test-smtp", async (req, res) => {
    try {
      const { email, appPassword, senderName, host, port, testTarget } = req.body;

      if (!email || !appPassword) {
        return res.status(400).json({
          success: false,
          error: "Gmail address and 16-character App Password are required."
        });
      }

      const transporter = createTransporter({ email, appPassword, host, port });
      
      // Verify connection
      await transporter.verify();

      // Send test email
      const recipient = testTarget && testTarget.trim() ? testTarget.trim() : email;
      const info = await transporter.sendMail({
        from: `"${senderName || 'BETGURU Security Team'}" <${email}>`,
        to: recipient,
        subject: "⚡ BETGURU Gmail SMTP Test Connection Success",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #020617; color: #f8fafc; padding: 28px; border-radius: 20px; border: 1px solid #a855f7; max-width: 550px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="background: rgba(168,85,247,0.2); color: #c084fc; border: 1px solid rgba(168,85,247,0.4); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; letter-spacing: 1px;">BETGURU LOTTERY • GMAIL SMTP</span>
              <h2 style="color: #fbbf24; font-size: 22px; margin: 12px 0 4px 0; font-weight: 900;">SMTP Connection Active!</h2>
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">Test verification email dispatched successfully</p>
            </div>

            <div style="background: #0f172a; padding: 18px; border-radius: 14px; border-left: 4px solid #10b981; margin-bottom: 20px;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #cbd5e1;"><strong>Sender Account:</strong> <span style="color: #f8fafc;">${email}</span></p>
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #cbd5e1;"><strong>Display Name:</strong> <span style="color: #c084fc;">${senderName || 'BETGURU Security Team'}</span></p>
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #cbd5e1;"><strong>SMTP Server:</strong> <span style="color: #f8fafc;">${host || 'smtp.gmail.com'}:${port || 587}</span></p>
              <p style="margin: 0; font-size: 13px; color: #cbd5e1;"><strong>Status:</strong> <span style="color: #34d399; font-weight: bold;">HTTP 200 OK • Handshake Verified</span></p>
            </div>

            <p style="color: #64748b; font-size: 11px; text-align: center; margin: 0;">
              BETGURU Automated Security Infrastructure • ${new Date().toLocaleString('en-IN')}
            </p>
          </div>
        `
      });

      return res.json({
        success: true,
        message: `SMTP connection verified! Sent test email to ${recipient}.`,
        messageId: info.messageId
      });
    } catch (err: any) {
      console.error("SMTP Test Error:", err);
      let userFriendlyError = err.message || "Failed to connect to SMTP server.";

      if (err.code === 'EAUTH' || (err.message && err.message.includes('Username and Password not accepted'))) {
        userFriendlyError = "Invalid Gmail address or Google App Password! Please make sure 2-Step Verification is ON and you are using a 16-character App Password (not your normal Gmail password).";
      } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT') {
        userFriendlyError = "Network connection timed out connecting to SMTP host. Check host and port settings.";
      }

      return res.status(500).json({
        success: false,
        error: userFriendlyError
      });
    }
  });

  // Send Email endpoint
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html, text, smtp } = req.body;

      if (!to || !smtp || !smtp.email || !smtp.appPassword) {
        return res.status(400).json({
          success: false,
          error: "Recipient email and SMTP credentials (email & appPassword) are required."
        });
      }

      const transporter = createTransporter(smtp);
      const info = await transporter.sendMail({
        from: `"${smtp.senderName || 'BETGURU Security'}" <${smtp.email}>`,
        to,
        subject: subject || 'BETGURU Notification',
        text: text || '',
        html: html || `<p>${text}</p>`
      });

      return res.json({
        success: true,
        message: `Email sent to ${to}`,
        messageId: info.messageId
      });
    } catch (err: any) {
      console.error("Send Email Error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to send email"
      });
    }
  });

  // Send OTP Email endpoint
  app.post("/api/send-otp", async (req, res) => {
    try {
      const { email, otp, name, type, smtp } = req.body;

      if (!email || !otp || !smtp || !smtp.email || !smtp.appPassword) {
        return res.status(400).json({
          success: false,
          error: "Target email, OTP code, and SMTP credentials are required."
        });
      }

      const transporter = createTransporter(smtp);
      const subject = type === 'registration'
        ? `🔐 Your BETGURU Registration OTP Code: ${otp}`
        : `🔐 Your BETGURU Security Verification OTP: ${otp}`;

      const info = await transporter.sendMail({
        from: `"${smtp.senderName || 'BETGURU Security Team'}" <${smtp.email}>`,
        to: email,
        subject,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #020617; color: #f8fafc; padding: 32px; border-radius: 24px; border: 1px solid #f59e0b; max-width: 520px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.4); padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: bold; letter-spacing: 1.5px;">BETGURU OFFICIAL SECURITY</span>
              <h1 style="color: #ffffff; font-size: 26px; margin: 12px 0 4px 0; font-weight: 900; letter-spacing: 1px;">
                BETGURU <span style="color: #fbbf24;">LOTTERY</span>
              </h1>
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">Verification Code for ${name || 'Player'}</p>
            </div>

            <div style="background: #0f172a; padding: 24px; border-radius: 18px; border: 1px solid #1e293b; text-align: center; margin-bottom: 24px;">
              <p style="color: #94a3b8; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 1px;">YOUR 6-DIGIT OTP CODE</p>
              <div style="font-size: 36px; font-weight: 900; color: #38bdf8; letter-spacing: 8px; font-family: monospace; background: #020617; padding: 14px; border-radius: 12px; border: 1px solid #0284c7; display: inline-block;">
                ${otp}
              </div>
              <p style="color: #ef4444; font-size: 11px; margin: 12px 0 0 0; font-weight: bold;">
                ⏱️ Valid for 10 minutes. Do not share this code with anyone.
              </p>
            </div>

            <p style="color: #cbd5e1; font-size: 12px; line-height: 1.6; text-align: center; margin-bottom: 20px;">
              Welcome to BETGURU Lottery! Enter this code in your app to complete your registration and claim your <strong>₹100 Free Bonus</strong>.
            </p>

            <div style="border-t: 1px solid #1e293b; pt: 16px; text-align: center; font-size: 10px; color: #64748b;">
              <p style="margin: 0;">256-Bit Encrypted • Sent via BETGURU Primary Gmail SMTP (${smtp.email})</p>
            </div>
          </div>
        `
      });

      return res.json({
        success: true,
        message: `OTP sent to ${email}`,
        messageId: info.messageId
      });
    } catch (err: any) {
      console.error("Send OTP Error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to send OTP"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
