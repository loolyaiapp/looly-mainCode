require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const razorpayRoutes     = require("./routes/razorpay");
const lemonsqueezyRoutes = require("./routes/lemonsqueezy");
const licenseRoutes      = require("./routes/license");
const askRoutes          = require("./routes/ask");

const path = require("path");
const app  = express();
const PORT = process.env.PORT || 3000;

// ── Global JSON parser — captures rawBody for webhook HMAC verification ──────
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));

// ── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:5173",    // Vite dev
    "http://localhost:1420",    // Tauri dev
    "http://localhost:3000",
    "tauri://localhost",        // Tauri production
    "https://tauri.localhost",
    "https://looly.app",        // future domain
  ],
  methods: ["GET", "POST"],
}));

// ── Landing page (static) ────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

// ── Routes ───────────────────────────────────────────────────
app.use("/api/razorpay",      razorpayRoutes);
app.use("/api/lemonsqueezy",  lemonsqueezyRoutes);
app.use("/api",               licenseRoutes);
app.use("/api",               askRoutes);

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   Looly Backend running on :${PORT}    ║
  ╠══════════════════════════════════════╣
  ║  POST /api/razorpay/create-order     ║
  ║  POST /api/razorpay/webhook          ║
  ║  POST /api/lemonsqueezy/webhook      ║
  ║  POST /api/verify-license            ║
  ║  GET  /api/health                    ║
  ╚══════════════════════════════════════╝
  `);
});
