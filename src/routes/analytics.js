const express  = require("express");
const supabase = require("../lib/supabase");

const router = express.Router();

router.post("/analytics", async (req, res) => {
  const { event, session_id, plan } = req.body;
  if (!event) return res.status(400).json({ error: "event required" });

  supabase.from("analytics_events").insert({
    event,
    session_id: session_id || null,
    plan:       plan       || null,
  }).then(() => {}).catch(e => console.warn("Analytics log error:", e.message));

  res.json({ ok: true });
});

module.exports = router;
