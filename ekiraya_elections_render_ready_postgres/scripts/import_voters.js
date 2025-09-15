
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.ELECTIONS_DB_PATH || "elections.db";
const CSV_PATH = process.env.CSV_PATH || "data/voters.csv";

const db = new Database(DB_PATH);

function parseCSV(text){
  return text.trim().split(/\r?\n/).map(l=>l.split(",").map(s=>s.trim()));
}

if(!fs.existsSync(CSV_PATH)){
  console.error("No existe CSV en:", CSV_PATH);
  process.exit(1);
}

const rows = parseCSV(fs.readFileSync(CSV_PATH, "utf8"));
let n=0;
for(const [dni,name,course] of rows){
  const otp = String(Math.floor(100000+Math.random()*900000));
  db.prepare("INSERT OR IGNORE INTO voters(dni,name,course,otp) VALUES(?,?,?,?)").run(dni,name,course,otp);
  n++;
}
console.log("Importados", n, "votantes");
