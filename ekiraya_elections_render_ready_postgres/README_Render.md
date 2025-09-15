
# Deploy en Render (Blueprint)

## 1) Sube este repo a GitHub
```bash
git init
git add .
git commit -m "Ekirayá Elections (Render ready)"
git branch -M main
git remote add origin <TU_REPO>
git push -u origin main
```

## 2) En Render
- New → **Blueprint** → señala tu repo con `render.yaml`.
- Render creará el servicio **ekiraya-elections** con:
  - Node 18
  - Disco persistente en `/var/data/ekiraya`
  - Variables `ELECTIONS_DB_PATH` y `ADMIN_CODE`
  - Comando de arranque: `node scripts/init_db.js && node server.js`

## 3) Inicializar/consultar la DB (Shell)
```bash
# Ver 5 OTP de ejemplo
sqlite3 /var/data/ekiraya/elections.db "select dni,name,course,otp from voters limit 5;"
# Importar más votantes desde CSV (sube data/voters.csv con dni,name,course)
CSV_PATH=/var/data/ekiraya/voters.csv ELECTIONS_DB_PATH=/var/data/ekiraya/elections.db node scripts/import_voters.js
```
