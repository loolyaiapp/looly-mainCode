const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendLicenseEmail({ to, key, plan, provider }) {
  const currency  = provider === "razorpay" ? "₹" : "$";
  const dashboard = provider === "razorpay"
    ? "dashboard.razorpay.com"
    : "app.lemonsqueezy.com/my-orders";

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0c0c12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#13131f;border-radius:16px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">

    <div style="padding:24px;background:linear-gradient(135deg,#f97316,#ea580c);text-align:center;">
      <div style="font-size:28px;margin-bottom:6px;">🧠</div>
      <div style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Welcome to Looly Pro</div>
      <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Your license key is ready</div>
    </div>

    <div style="padding:28px;">
      <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0 0 20px;">
        Thank you for your purchase! Here is your license key:
      </p>

      <div style="background:#0c0c12;border:1px solid rgba(249,115,22,0.3);border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <div style="color:rgba(255,255,255,0.4);font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">License Key</div>
        <div style="color:#fb923c;font-size:18px;font-weight:700;letter-spacing:2px;font-family:monospace;">${key}</div>
      </div>

      <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px;margin-bottom:24px;">
        <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">How to activate</div>
        <div style="color:rgba(255,255,255,0.75);font-size:13px;line-height:1.8;">
          1. Open <b style="color:white;">Looly</b> on your PC<br/>
          2. Click the <b style="color:white;">⚙ Settings</b> icon<br/>
          3. Paste your license key<br/>
          4. Click <b style="color:white;">Activate</b>
        </div>
      </div>

      <div style="color:rgba(255,255,255,0.35);font-size:11px;line-height:1.7;">
        • This key is tied to your email address<br/>
        • Subscription renews automatically every month<br/>
        • To cancel: visit ${dashboard}<br/>
        • Need help? Reply to this email
      </div>
    </div>

    <div style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
      <div style="color:rgba(255,255,255,0.2);font-size:10px;">Looly — Invisible AI Interview Assistant</div>
    </div>

  </div>
</body>
</html>`;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: "🧠 Your Looly Pro License Key",
    html,
  });
}

module.exports = { sendLicenseEmail };
