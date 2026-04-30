const express = require("express");
const { verifyLicense } = require("../lib/keys");

const router = express.Router();

// ── Verify License ───────────────────────────────────────────
// Looly app calls this on startup to check if the key is valid
// POST /api/verify-license  { "key": "LOOLY-XXXX-XXXX-XXXX-XXXX" }
router.post("/verify-license", async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ valid: false, reason: "No key provided" });

    const result = await verifyLicense(key);

    if (!result.valid) {
      return res.status(200).json({ valid: false, reason: result.reason });
    }

    // Return minimal info — don't expose full license row
    return res.json({
      valid:      true,
      plan:       result.license.plan,
      email:      result.license.email,
      expiresAt:  result.license.expires_at,
    });
  } catch (e) {
    console.error("verify-license error:", e);
    res.status(500).json({ valid: false, reason: "Server error — try again later" });
  }
});

// ── Health Check ─────────────────────────────────────────────
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = router;
