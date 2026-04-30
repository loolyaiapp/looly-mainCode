const express = require("express");
const Groq    = require("groq-sdk");
const { verifyLicense } = require("../lib/keys");

const router = express.Router();

// ── Groq key pool ────────────────────────────────────────────
// Reads GROQ_API_KEY_1 through GROQ_API_KEY_6 from env
function loadKeys() {
  const keys = [1, 2, 3, 4, 5, 6]
    .map(n => (process.env[`GROQ_API_KEY_${n}`] || "").trim())
    .filter(Boolean);
  if (keys.length === 0) throw new Error("No Groq API keys configured");
  return keys;
}

let _keyIndex = 0;
function nextKey(keys) {
  const key = keys[_keyIndex % keys.length];
  _keyIndex  = (_keyIndex + 1) % keys.length;
  return key;
}

const SYSTEM_PROMPT = `You are an elite real-time interview assistant. Be sharp, precise, and interview-ready.

Rules:
- Coding questions: Give the optimal solution with time/space complexity. Code first, brief explanation after.
- Behavioral/HR: Use STAR format (Situation, Task, Action, Result). Keep it punchy — 3–4 sentences per part.
- System design: List key components, data flow, and 2–3 critical tradeoffs.
- Algorithms/math: State the approach, then show working code.
- Always format code inside triple backtick blocks with the language name.
- Be direct. No fluff. Interviewers respect confidence.`;

// POST /api/ask
// Pro users call this instead of Groq directly — no API key needed on their end.
// Streams back SSE: data: {"text":"..."}\n\n ... data: [DONE]\n\n
router.post("/ask", async (req, res) => {
  const { licenseKey, question, model } = req.body;

  if (!licenseKey) return res.status(400).json({ error: "licenseKey required" });
  if (!question?.trim()) return res.status(400).json({ error: "question required" });

  // Validate license
  const validation = await verifyLicense(licenseKey);
  if (!validation.valid) {
    return res.status(403).json({ error: `License invalid: ${validation.reason}` });
  }

  let keys;
  try { keys = loadKeys(); } catch {
    return res.status(500).json({ error: "Groq API keys not configured on server" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Try each key once; skip to the next on rate-limit (429)
  let lastError = null;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const apiKey = nextKey(keys);
    try {
      const groq   = new Groq({ apiKey });
      const stream = await groq.chat.completions.create({
        model:      model || "llama-3.3-70b-versatile",
        stream:     true,
        max_tokens: 1500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: question.trim() },
        ],
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
      return; // success — done
    } catch (e) {
      const isRateLimit = e?.status === 429 || e?.message?.includes("429") || e?.message?.includes("rate_limit");
      if (isRateLimit && attempt < keys.length - 1) {
        console.warn(`Groq key #${attempt + 1} rate-limited, trying next key…`);
        lastError = e;
        continue; // try next key
      }
      // Non-rate-limit error or exhausted all keys
      console.error("ask route error:", e.message);
      if (!res.writableEnded) {
        const msg = isRateLimit
          ? "⚠️ All Groq keys are rate-limited right now — wait a moment and try again."
          : `⚠️ AI request failed: ${e.message}`;
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        res.end();
      }
      return;
    }
  }

  // Exhausted all keys (all rate-limited)
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify({ error: "⚠️ All Groq keys are rate-limited — try again in a moment." })}\n\n`);
    res.end();
  }
});

module.exports = router;
