const express  = require("express");
const crypto   = require("crypto");
const Razorpay = require("razorpay");
const { createLicense } = require("../lib/keys");
const { sendLicenseEmail } = require("../lib/mailer");

const router = express.Router();

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Create Order ─────────────────────────────────────────────
// Frontend calls this to get an order_id before opening Razorpay modal
router.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", plan = "pro", email } = req.body;
    if (!amount) return res.status(400).json({ error: "amount is required" });

    const order = await razorpay.orders.create({
      amount,           // in paise (e.g. 999900 = ₹9,999)
      currency,
      receipt: `looly_${Date.now()}`,
      notes: { plan, email: email || "" },
    });

    res.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
    });
  } catch (e) {
    console.error("Razorpay create-order error:", e);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// ── Verify Payment (client-side) ─────────────────────────────
// Landing page calls this after Razorpay modal closes with success.
// Verifies signature, creates license, emails it, returns key immediately.
router.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, plan } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const sign     = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed — invalid signature" });
    }

    const resolvedPlan = plan || "pro-annual";
    const license = await createLicense({
      email,
      plan:           resolvedPlan,
      provider:       "razorpay",
      paymentId:      razorpay_payment_id,
      subscriptionId: null,
      amount:         null,
      currency:       "INR",
    });

    // Fire email in background — don't block the response
    sendLicenseEmail({ to: email, key: license.key, plan: resolvedPlan, provider: "razorpay" })
      .catch(e => console.error("License email error:", e.message));

    res.json({ licenseKey: license.key, email, expiresAt: license.expires_at });
  } catch (e) {
    console.error("Razorpay verify-payment error:", e);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// ── Webhook ──────────────────────────────────────────────────
// Razorpay calls this after a successful payment
// Must use raw body for signature verification — set in index.js
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const secret    = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret || secret === "PASTE_RAZORPAY_WEBHOOK_SECRET_HERE") {
      console.warn("Razorpay webhook: secret not configured, skipping signature check");
    } else {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(req.rawBody)
        .digest("hex");
      if (expected !== signature) {
        console.warn("Razorpay webhook: invalid signature");
        return res.status(400).json({ error: "Invalid signature" });
      }
    }

    const event = JSON.parse(req.rawBody);
    console.log("Razorpay event:", event.event);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const email   = payment.email || payment.notes?.email;

      if (!email) {
        console.warn("No email in Razorpay payment, skipping license generation");
        return res.json({ ok: true });
      }

      const license = await createLicense({
        email,
        plan:           payment.notes?.plan || "pro",
        provider:       "razorpay",
        paymentId:      payment.id,
        subscriptionId: payment.subscription_id || null,
        amount:         payment.amount,
        currency:       payment.currency,
      });

      await sendLicenseEmail({ to: email, key: license.key, plan: "pro", provider: "razorpay" });
      console.log(`✅ Razorpay license created: ${license.key} → ${email}`);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("Razorpay webhook error:", e);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;
