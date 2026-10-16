require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3000);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL. Set it in backend/.env or your hosting dashboard.");
  process.exit(1);
}
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // No Origin header is normal for health checks and some API clients.
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-admin-api-key"]
}));
app.use(express.json({ limit: "20kb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));

app.get("/", (_req, res) => res.json({ service: "Kongu Job Agency API", health: "/health" }));
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("Health database check failed:", error.message);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

function cleanString(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\u0000/g, "").slice(0, max);
}
app.post("/api/applications", async (req, res) => {
  const body = req.body || {};
  const fullName = cleanString(body.fullName, 100);
  const phone = cleanString(body.phone, 20);
  const email = cleanString(body.email, 254);
  const qualification = cleanString(body.qualification, 80);
  const jobCategory = cleanString(body.jobCategory, 80);
  const preferredLocation = cleanString(body.preferredLocation, 100);
  const skills = cleanString(body.skills, 1500);
  const consent = body.consent === true || body.consent === "on" || body.consent === "true";

  if (fullName.length < 2) return res.status(400).json({ error: "Please enter your full name." });
  if (!/^[+()\d\s.-]{7,20}$/.test(phone)) return res.status(400).json({ error: "Please enter a valid phone number." });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (!qualification || !jobCategory) return res.status(400).json({ error: "Please select your qualification and job category." });
  if (!consent) return res.status(400).json({ error: "Consent is required before submitting an application." });

  try {
    const result = await pool.query(
      `INSERT INTO candidate_applications
       (full_name, phone, email, qualification, job_category, preferred_location, skills, consent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, created_at`,
      [fullName, phone, email || null, qualification, jobCategory, preferredLocation || null, skills || null, consent]
    );
    res.status(201).json({ ok: true, applicationId: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (error) {
    console.error("Application insert failed:", error.message);
    res.status(500).json({ error: "We could not save your application right now. Please try again later or contact us by WhatsApp." });
  }
});

function requireAdmin(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey || configuredKey.length < 32) {
    return res.status(503).json({ error: "Admin API is not configured. Set a strong ADMIN_API_KEY." });
  }
  const suppliedKey = req.get("x-admin-api-key") || "";
  if (suppliedKey.length !== configuredKey.length || suppliedKey !== configuredKey) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  next();
}
app.get("/api/admin/applications", requireAdmin, async (req, res) => {
  const status = cleanString(req.query.status, 20);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
  try {
    let result;
    if (status) {
      result = await pool.query(
        `SELECT id, full_name, phone, email, qualification, job_category, preferred_location, skills, status, created_at, updated_at
         FROM candidate_applications WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
        [status, limit]
      );
    } else {
      result = await pool.query(
        `SELECT id, full_name, phone, email, qualification, job_category, preferred_location, skills, status, created_at, updated_at
         FROM candidate_applications ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
    }
    res.json({ applications: result.rows });
  } catch (error) {
    console.error("Admin list failed:", error.message);
    res.status(500).json({ error: "Could not retrieve applications." });
  }
});
app.patch("/api/admin/applications/:id", requireAdmin, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const status = cleanString(req.body && req.body.status, 20);
  const allowedStatuses = ["New", "Contacted", "Interview", "Placed", "Closed"];
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid application ID." });
  if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "Invalid status." });
  try {
    const result = await pool.query(
      `UPDATE candidate_applications SET status = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, status, updated_at`,
      [status, id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Application not found." });
    res.json({ ok: true, application: result.rows[0] });
  } catch (error) {
    console.error("Admin update failed:", error.message);
    res.status(500).json({ error: "Could not update application status." });
  }
});

app.use((err, _req, res, _next) => {
  if (err && err.message === "Origin not allowed by CORS") return res.status(403).json({ error: "This website origin is not allowed." });
  console.error("Unhandled server error:", err && err.message);
  res.status(500).json({ error: "Unexpected server error." });
});
app.listen(port, () => console.log(`Kongu Job Agency API listening on port ${port}`));
process.on("SIGTERM", async () => { await pool.end(); process.exit(0); });
