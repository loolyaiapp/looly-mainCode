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

// Deletes analytics events older than 90 days — call via cron or manually
router.delete("/analytics/cleanup", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const { error, count } = await supabase
    .from("analytics_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff.toISOString());
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: count });
});

module.exports = router;
