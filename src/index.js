require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const rateLimit    = require("express-rate-limit");
const razorpayRoutes     = require("./routes/razorpay");
const lemonsqueezyRoutes = require("./routes/lemonsqueezy");
const licenseRoutes      = require("./routes/license");
const askRoutes          = require("./routes/ask");
const downloadRoutes     = require("./routes/download");
const analyticsRoutes    = require("./routes/analytics");
const adminRoutes        = require("./routes/admin");
const authRoutes         = require("./routes/auth");

const path = require("path");
const app  = express();
const PORT = process.env.PORT || 3000;

// ── Global JSON parser — captures rawBody for webhook HMAC verification ──────
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));

// ── CORS ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://looly-maincode-production.up.railway.app",
  "http://localhost:3000",
  "http://localhost:1420",
  "tauri://localhost",
  "https://tauri.localhost",
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Tauri app, curl, webhooks)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-token"],
}));

// ── Rate limiting ─────────────────────────────────────────────
const askLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 30,                   // 30 requests/min per IP
  message: { error: "Too many requests — slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

const licenseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Landing page (static) ────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

// ── Routes ───────────────────────────────────────────────────
app.use("/api/razorpay",      razorpayRoutes);
app.use("/api/lemonsqueezy",  lemonsqueezyRoutes);
app.use("/api",               licenseLimiter, licenseRoutes);
app.use("/api",               askLimiter,     askRoutes);
app.use("/api",               downloadRoutes);
app.use("/api",               analyticsRoutes);
app.use("/",                  authLimiter, authRoutes);
app.use("/",                  adminRoutes);

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
  ║  GET  /api/download                  ║
  ║  POST /api/analytics                 ║
  ║  GET  /admin                         ║
  ║  GET  /api/admin/stats               ║
  ╚══════════════════════════════════════╝
  `);
});
