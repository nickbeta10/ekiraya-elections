
import pkg from "pg";

// This initialization script has been adapted to work with PostgreSQL instead of SQLite.
// It connects using the DATABASE_URL environment variable and creates the necessary
// tables if they don't already exist. It also seeds demo data for admin, mesas,
// voters and candidates.

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "development" ? false : { rejectUnauthorized: false },
});

async function init() {
  // Create tables using PostgreSQL syntax. SERIAL creates an auto-incrementing integer.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin (
      code TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS mesas (
      id SERIAL PRIMARY KEY,
      name TEXT,
      code TEXT UNIQUE,
      code_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS mesa_keys (
      key TEXT PRIMARY KEY,
      mesa_id INTEGER,
      created_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS voters (
      dni TEXT PRIMARY KEY,
      name TEXT,
      course TEXT,
      otp TEXT,
      is_blocked INTEGER DEFAULT 0,
      has_voted_rep INTEGER DEFAULT 0,
      has_voted_amb INTEGER DEFAULT 0,
      has_voted_per INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      race TEXT,
      name TEXT,
      detail TEXT,
      course TEXT
    );
    CREATE TABLE IF NOT EXISTS ballots (
      id SERIAL PRIMARY KEY,
      ballot_id TEXT,
      mesa_id INTEGER,
      race TEXT,
      candidate_id TEXT,
      created_at TIMESTAMP,
      audit_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS ledger (
      id SERIAL PRIMARY KEY,
      ballot_id TEXT,
      mesa_id INTEGER,
      timestamp TIMESTAMP,
      races TEXT,
      audit_hash TEXT
    );
  `);

  const ADMIN_CODE = process.env.ADMIN_CODE || "ADMIN-2025";
  await pool.query(
    "INSERT INTO admin(code) VALUES($1) ON CONFLICT DO NOTHING",
    [ADMIN_CODE]
  );

  // Mesas demo
  const mesaCodes = ["MESA-1-2025", "MESA-2-2025", "MESA-3-2025", "MESA-4-2025"];
  for (let i = 0; i < mesaCodes.length; i++) {
    const code = mesaCodes[i];
    const name = `Mesa ${i + 1}`;
    await pool.query(
      "INSERT INTO mesas(name, code, code_hash) VALUES($1,$2,$3) ON CONFLICT (code) DO NOTHING",
      [name, code, ""]
    );
  }

  // Voters demo (20)
  const voters = [
    ["1001", "Ana Torres", "T3A"],
    ["1002", "Luis Pérez", "T3A"],
    ["1003", "Marta Díaz", "T3B"],
    ["1004", "Juan Gómez", "T3B"],
    ["1005", "Sofía Rojas", "T3C"],
    ["1006", "Carlos Ruiz", "T4A"],
    ["1007", "Daniela Melo", "T4A"],
    ["1008", "Esteban Gil", "T4B"],
    ["1009", "Valeria Sol", "T4B"],
    ["1010", "Diego León", "T4C"],
    ["1011", "Paula Arias", "T5A"],
    ["1012", "Camilo Lara", "T5A"],
    ["1013", "Nicolás Rey", "T5B"],
    ["1014", "Sara Cifuentes", "T5B"],
    ["1015", "Lina Medina", "T3A"],
    ["1016", "Tomás Silva", "T4C"],
    ["1017", "Juliana Mora", "T3C"],
    ["1018", "Felipe Ospina", "T4A"],
    ["1019", "Andrés Paz", "T5B"],
    ["1020", "Laura Mesa", "T5A"],
  ];
  for (const [dni, name, course] of voters) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await pool.query(
      "INSERT INTO voters(dni,name,course,otp) VALUES($1,$2,$3,$4) ON CONFLICT (dni) DO NOTHING",
      [dni, name, course, otp]
    );
  }

  // Candidates demo
  const cand = [
    // Representante por curso
    ["rep", "T3A", "Camila Pardo", "Lista 1"],
    ["rep", "T3A", "Mateo Llano", "Lista 2"],
    ["rep", "T3B", "Valentina Roa", "Lista 3"],
    ["rep", "T3C", "Samuel Ortiz", "Lista 1"],
    ["rep", "T4A", "Isabella Niño", "Lista 2"],
    ["rep", "T4B", "Juanita Vega", "Lista 4"],
    ["rep", "T4C", "Santiago Melo", "Lista 1"],
    ["rep", "T5A", "María B.", "Lista 2"],
    ["rep", "T5B", "David C.", "Lista 3"],
    // Líder ambiental por curso
    ["amb", "T3A", "Héctor M.", "Reciclaje"],
    ["amb", "T3B", "Elena A.", "Huerta"],
    ["amb", "T3C", "Kevin R.", "Energía"],
    ["amb", "T4A", "Sara Q.", "Agua"],
    ["amb", "T4B", "Laura P.", "Aseo"],
    ["amb", "T4C", "Brayan D.", "Reforestación"],
    ["amb", "T5A", "Nicole F.", "Campañas"],
    ["amb", "T5B", "Pedro Z.", "Ruido"],
    // Personería (colegio)
    ["per", null, "Personería Lista A", ""],
    ["per", null, "Personería Lista B", ""],
  ];
  for (const [race, course, name, detail] of cand) {
    const id = `${race}-${(course || "ALL")}-${name}`.replace(/\s+/g, "_");
    await pool.query(
      "INSERT INTO candidates(id,race,name,detail,course) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
      [id, race, name, detail, course]
    );
  }

  console.log("DB inicializada con datos de ejemplo.");
}

init().then(() => pool.end());
