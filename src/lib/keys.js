const crypto = require("crypto");
const supabase = require("./supabase");

// Generates a key like: LOOLY-A3FX-9KLP-MN72-X8QR
function generateKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusables (0/O, 1/I)
  const segment = (len) =>
    Array.from({ length: len }, () => chars[crypto.randomInt(chars.length)]).join("");
  return `LOOLY-${segment(4)}-${segment(4)}-${segment(4)}-${segment(4)}`;
}

// Creates a unique key, retries on collision (extremely rare)
async function createLicense({ email, plan, provider, paymentId, subscriptionId, amount, currency }) {
  // Return existing license if this payment was already processed (webhook + client-verify dedup)
  if (paymentId) {
    const { data: existing } = await supabase
      .from("licenses")
      .select("*")
      .eq("payment_id", paymentId)
      .maybeSingle();
    if (existing) return existing;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateKey();

    // Annual = 370 days (365 + 5 grace), Monthly = 35 days (30 + 5 grace)
    const isAnnual  = plan === "pro-annual" || plan === "pro";
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (isAnnual ? 370 : 35));

    const { data, error } = await supabase
      .from("licenses")
      .insert({
        key,
        email,
        plan,
        provider,
        payment_id:      paymentId,
        subscription_id: subscriptionId,
        amount,
        currency,
        status:          "active",
        expires_at:      expiresAt.toISOString(),
      })
      .select()
      .single();

    if (!error) return data;
    // If unique violation, retry with a new key; otherwise throw
    if (!error.message.includes("unique")) throw error;
  }
  throw new Error("Failed to generate unique license key after 5 attempts");
}

// Verifies a key: returns { valid, reason, license }
async function verifyLicense(key) {
  if (!key || !key.startsWith("LOOLY-")) {
    return { valid: false, reason: "Invalid key format" };
  }

  const { data: license, error } = await supabase
    .from("licenses")
    .select("*")
    .eq("key", key.trim().toUpperCase())
    .single();

  if (error || !license) return { valid: false, reason: "Key not found" };
  if (license.status !== "active") return { valid: false, reason: `Subscription ${license.status}` };
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    // Mark as expired
    await supabase.from("licenses").update({ status: "expired" }).eq("key", key);
    return { valid: false, reason: "Subscription expired — please renew" };
  }

  return { valid: true, license };
}

module.exports = { createLicense, verifyLicense };
