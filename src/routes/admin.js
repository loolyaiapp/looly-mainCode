const express  = require("express");
const supabase = require("../lib/supabase");
const path     = require("path");

const router = express.Router();

router.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../public/admin.html"));
});

router.get("/api/admin/stats", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [downloadsRes, licensesRes, recentLicensesRes, recentDownloadsRes, eventsRes] =
      await Promise.all([
        supabase.from("downloads").select("*", { count: "exact", head: true }),
        supabase.from("licenses").select("plan, created_at"),
        supabase.from("licenses")
          .select("email, plan, created_at, payment_id")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase.from("downloads")
          .select("ip, user_agent, referrer, created_at")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase.from("analytics_events")
          .select("event, session_id, plan, created_at")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

    // Plan breakdown
    const plans = { "pro-monthly": 0, "pro-annual": 0, "pro-trial15": 0 };
    const dailySignups = {};
    for (const row of licensesRes.data || []) {
      if (row.plan === "pro-monthly")                           plans["pro-monthly"]++;
      else if (row.plan === "pro-trial15")                      plans["pro-trial15"]++;
      else if (row.plan === "pro-annual" || row.plan === "pro") plans["pro-annual"]++;
      const day = (row.created_at || "").slice(0, 10);
      if (day) dailySignups[day] = (dailySignups[day] || 0) + 1;
    }

    // Event aggregates
    const eventCounts = {};
    const dailyAsks   = {};
    for (const row of eventsRes.data || []) {
      eventCounts[row.event] = (eventCounts[row.event] || 0) + 1;
      if (row.event === "question_asked") {
        const day = (row.created_at || "").slice(0, 10);
        if (day) dailyAsks[day] = (dailyAsks[day] || 0) + 1;
      }
    }

    res.json({
      downloads:       downloadsRes.count || 0,
      plans,
      totalPro:        plans["pro-monthly"] + plans["pro-annual"],
      revenueINR:      plans["pro-monthly"] * 4700 + plans["pro-annual"] * 9999 + plans["pro-trial15"] * 2500,
      recentLicenses:  recentLicensesRes.data  || [],
      recentDownloads: recentDownloadsRes.data || [],
      eventCounts,
      dailyAsks,
      dailySignups,
    });
  } catch (e) {
    console.error("Admin stats error:", e);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
