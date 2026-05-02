const express  = require("express");
const supabase = require("../lib/supabase");

const router = express.Router();

const APP_URL = process.env.APP_URL || "https://looly-maincode-production.up.railway.app";

// ── Google OAuth redirect ────────────────────────────────────
// User clicks "Sign in with Google" → hits this → redirected to Google
router.get("/api/auth/google", (_req, res) => {
  const redirectTo = encodeURIComponent(APP_URL);
  const url = `${process.env.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  res.redirect(url);
});

// ── Get current user + their licenses ───────────────────────
// Frontend calls this with the Supabase access_token from URL hash
router.get("/api/me", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid or expired session — please sign in again" });

    const { data: licenses } = await supabase
      .from("licenses")
      .select("key, plan, created_at, expires_at")
      .eq("email", user.email)
      .order("created_at", { ascending: false });

    res.json({
      email:    user.email,
      name:     user.user_metadata?.full_name || user.user_metadata?.name || "",
      avatar:   user.user_metadata?.avatar_url || "",
      licenses: licenses || [],
    });
  } catch (e) {
    console.error("/api/me error:", e.message);
    res.status(401).json({ error: "Authentication failed" });
  }
});

module.exports = router;
