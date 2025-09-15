
import express from "express";
import helmet from "helmet";
import cors from "cors";
import pkg from "pg";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

// Use pg Pool to connect to PostgreSQL instead of SQLite.
const { Pool } = pkg;

const app = express();
app.use(helmet());
app.use(cors({ origin: false }));
app.use(express.json());
app.use(express.static("public"));

// Initialise PostgreSQL connection pool using DATABASE_URL environment variable.
// When running on platforms like Render or Railway, DATABASE_URL should include
// the full connection string (e.g. postgres://user:password@host:port/dbname).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "development" ? false : { rejectUnauthorized: false },
});

// Helper functions to emulate the basic API of better-sqlite3. All queries
// return promises and need to be awaited. Named parameters are replaced with
// positional parameters ($1, $2, ...) for PostgreSQL.
async function dbGet(query, params = []) {
  const res = await pool.query(query, params);
  return res.rows[0];
}

async function dbAll(query, params = []) {
  const res = await pool.query(query, params);
  return res.rows;
}

async function dbRun(query, params = []) {
  await pool.query(query, params);
}

async function getMesaIdFromKey(req) {
  const key = req.headers["x-mesa-key"];
  if (!key) return null;
  const row = await dbGet("SELECT mesa_id FROM mesa_keys WHERE key = $1", [key]);
  return row ? row.mesa_id : null;
}

// --- API ---

// Mesa login: jurado ingresa código de su mesa y recibe una llave local
app.post("/api/mesa/login", async (req, res) => {
  const { mesa_code } = req.body || {};
  if (!mesa_code) return res.json({ ok: false, error: "Falta código" });
  const mesa = await dbGet("SELECT id, code_hash FROM mesas WHERE code = $1", [mesa_code]);
  if (!mesa) return res.json({ ok: false, error: "Código inválido" });
  const mesa_key = uuidv4();
  await dbRun(
    "INSERT INTO mesa_keys(key, mesa_id, created_at) VALUES($1, $2, NOW())",
    [mesa_key, mesa.id]
  );
  return res.json({ ok: true, mesa_key });
});

// Verificar identidad (dni + otp). Devuelve races y opciones aplicables
app.post("/api/voter/verify", async (req, res) => {
  const mesaId = await getMesaIdFromKey(req);
  if (!mesaId) return res.json({ ok: false, error: "Mesa no autenticada" });
  const { dni, otp } = req.body || {};
  const voter = await dbGet(
    "SELECT dni,name,course,otp,is_blocked, has_voted_rep,has_voted_amb,has_voted_per FROM voters WHERE dni = $1",
    [dni]
  );
  if (!voter) return res.json({ ok: false, error: "No encontrado" });
  if (voter.is_blocked) return res.json({ ok: false, error: "Bloqueado, dirígete a coordinación" });
  if (String(otp) !== String(voter.otp)) return res.json({ ok: false, error: "PIN incorrecto" });

  // Build races based on course
  const repCandidates = await dbAll(
    "SELECT id,name,detail FROM candidates WHERE race = 'rep' AND course = $1",
    [voter.course]
  );
  const ambCandidates = await dbAll(
    "SELECT id,name,detail FROM candidates WHERE race = 'amb' AND course = $1",
    [voter.course]
  );
  const perCandidates = await dbAll(
    "SELECT id,name,detail FROM candidates WHERE race = 'per'",
    []
  );

  const races = {
    rep: { title: `Representante (${voter.course})`, candidates: repCandidates },
    amb: { title: `Líder Ambiental (${voter.course})`, candidates: ambCandidates },
    per: { title: `Personería (Colegio)`, candidates: perCandidates },
  };

  return res.json({ ok: true, voter, races });
});

// Registrar voto. Guarda boleta anónima y marca como votado.
app.post("/api/vote/cast", async (req, res) => {
  const mesaId = await getMesaIdFromKey(req);
  if (!mesaId) return res.json({ ok: false, error: "Mesa no autenticada" });
  const { dni, otp, rep, amb, per } = req.body || {};
  const voter = await dbGet("SELECT * FROM voters WHERE dni = $1", [dni]);
  if (!voter) return res.json({ ok: false, error: "No encontrado" });
  if (String(otp) !== String(voter.otp)) return res.json({ ok: false, error: "PIN incorrecto" });
  // prevent double vote per race
  if (voter.has_voted_rep && rep) return res.json({ ok: false, error: "Ya votó representante" });
  if (voter.has_voted_amb && amb) return res.json({ ok: false, error: "Ya votó líder ambiental" });
  if (voter.has_voted_per && per) return res.json({ ok: false, error: "Ya votó personería" });

  const ballot_id = uuidv4();
  const now = new Date().toISOString();
  const races = [];

  function auditHash(payload) {
    return bcrypt.hashSync(payload, 8).slice(-32);
  }

  if (rep) {
    await dbRun(
      "INSERT INTO ballots(ballot_id, mesa_id, race, candidate_id, created_at, audit_hash) VALUES($1, $2, 'rep', $3, $4, $5)",
      [ballot_id, mesaId, rep, now, auditHash(`${dni}|rep|${now}`)]
    );
    await dbRun("UPDATE voters SET has_voted_rep = 1 WHERE dni = $1", [dni]);
    races.push("rep");
  }
  if (amb) {
    await dbRun(
      "INSERT INTO ballots(ballot_id, mesa_id, race, candidate_id, created_at, audit_hash) VALUES($1, $2, 'amb', $3, $4, $5)",
      [ballot_id, mesaId, amb, now, auditHash(`${dni}|amb|${now}`)]
    );
    await dbRun("UPDATE voters SET has_voted_amb = 1 WHERE dni = $1", [dni]);
    races.push("amb");
  }
  if (per) {
    await dbRun(
      "INSERT INTO ballots(ballot_id, mesa_id, race, candidate_id, created_at, audit_hash) VALUES($1, $2, 'per', $3, $4, $5)",
      [ballot_id, mesaId, per, now, auditHash(`${dni}|per|${now}`)]
    );
    await dbRun("UPDATE voters SET has_voted_per = 1 WHERE dni = $1", [dni]);
    races.push("per");
  }
  // rotate OTP so it can't be reused
  const newOtp = Math.floor(100000 + Math.random() * 900000);
  await dbRun("UPDATE voters SET otp = $1 WHERE dni = $2", [String(newOtp), dni]);

  await dbRun(
    "INSERT INTO ledger(ballot_id, mesa_id, timestamp, races, audit_hash) VALUES($1, $2, $3, $4, $5)",
    [
      ballot_id,
      mesaId,
      now,
      races.join(","),
      bcrypt.hashSync(`${ballot_id}|${mesaId}`, 8).slice(-32),
    ]
  );
  return res.json({ ok: true, receipt: ballot_id });
});

// Ledger visible por mesa (equipo)
app.get("/api/mesa/ledger", async (req, res) => {
  const mesaId = await getMesaIdFromKey(req);
  if (!mesaId) return res.json({ ok: false, error: "Mesa no autenticada" });
  const rows = await dbAll(
    "SELECT * FROM ledger WHERE mesa_id = $1 ORDER BY timestamp DESC LIMIT 100",
    [mesaId]
  );
  const items = rows.map((r) => ({
    ballot_id: r.ballot_id,
    timestamp: r.timestamp,
    races: r.races.split(","),
    audit_hash: r.audit_hash,
  }));
  res.json({ ok: true, items });
});

// Resultados admin
app.post("/api/admin/results", async (req, res) => {
  const { code } = req.body || {};
  const admin = await dbGet("SELECT code FROM admin WHERE code = $1", [code]);
  if (!admin) return res.json({ ok: false, error: "Código inválido" });

  async function sumByRace(race) {
    return await dbAll(
      `SELECT COALESCE(c.name, 'Blanco') AS name, COUNT(b.id) AS count
       FROM ballots b LEFT JOIN candidates c ON b.candidate_id = c.id
       WHERE b.race = $1
       GROUP BY b.candidate_id
       ORDER BY count DESC`,
      [race]
    );
  }

  const byMesa = await dbAll(
    "SELECT mesa_id, COUNT(*) AS votos FROM ballots GROUP BY mesa_id",
    []
  );
  res.json({ ok: true, results: { rep: await sumByRace("rep"), amb: await sumByRace("amb"), per: await sumByRace("per"), byMesa } });
});

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log("Servidor en http://localhost:"+port));
