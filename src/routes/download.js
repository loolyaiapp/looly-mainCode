const express  = require("express");
const supabase = require("../lib/supabase");

const router = express.Router();

const RELEASE_URL = "https://github.com/loolyaiapp/looly-mainCode/releases/latest/download/Looly_0.1.0_x64-setup.exe";

router.get("/download", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.socket.remoteAddress
    || "unknown";

  supabase.from("downloads").insert({
    ip,
    user_agent: req.headers["user-agent"] || null,
    referrer:   req.headers["referer"]    || null,
  }).then(() => {}).catch(e => console.warn("Download log error:", e.message));

  res.redirect(302, RELEASE_URL);
});

module.exports = router;
