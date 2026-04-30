const express = require("express");
const crypto  = require("crypto");
const { createLicense } = require("../lib/keys");
const { sendLicenseEmail } = require("../lib/mailer");

const router = express.Router();

// ── Webhook ──────────────────────────────────────────────────
// Lemon Squeezy calls this after order/subscription events
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-signature"];
    const secret    = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    // Verify HMAC-SHA256 signature
    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.rawBody)
      .digest("hex");

    if (expected !== signature) {
      console.warn("LemonSqueezy webhook: invalid signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(req.rawBody);
    const type  = event.meta?.event_name;
    console.log("LemonSqueezy event:", type);

    // Fire on new order OR new subscription
    if (type === "order_created" || type === "subscription_created") {
      const attrs = event.data?.attributes;
      const email = attrs?.user_email || attrs?.customer_email;

      if (!email) {
        console.warn("No email in LemonSqueezy event, skipping");
        return res.json({ ok: true });
      }

      const license = await createLicense({
        email,
        plan:           "pro",
        provider:       "lemonsqueezy",
        paymentId:      String(event.data?.id || ""),
        subscriptionId: type === "subscription_created" ? String(event.data?.id) : null,
        amount:         attrs?.total || attrs?.first_subscription_item?.price || 0,
        currency:       (attrs?.currency || "USD").toUpperCase(),
      });

      await sendLicenseEmail({ to: email, key: license.key, plan: "pro", provider: "lemonsqueezy" });
      console.log(`✅ LemonSqueezy license created: ${license.key} → ${email}`);
    }

    // Handle subscription cancellations
    if (type === "subscription_cancelled" || type === "subscription_expired") {
      const supabase = require("../lib/supabase");
      const subId    = String(event.data?.id || "");
      if (subId) {
        const newStatus = type === "subscription_cancelled" ? "cancelled" : "expired";
        await supabase.from("licenses").update({ status: newStatus }).eq("subscription_id", subId);
        console.log(`⚠️ LemonSqueezy subscription ${subId} marked ${newStatus}`);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("LemonSqueezy webhook error:", e);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;
