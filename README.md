
# Elecciones Ekirayá · Anicora (Demo lista para Netlify/Vercel/Render)

## Cómo correr localmente
1. Instala Node 18+
2. En este folder:
```bash
npm install
node scripts/init_db.js   # crea elections.db con datos de prueba
npm start                 # abre http://localhost:3000
```
- **/ (index)**: pantalla para la mesa (jurados). Usa códigos `MESA-1-2025` ... `MESA-4-2025`.
- **/admin.html**: resultados y conteos. Código admin: `ADMIN-2025`.

## Flujo antifraude
- Cada estudiante tiene **OTP** (PIN de 6 dígitos) de un solo uso.
- La mesa inicia sesión con su **código de mesa** y queda registrada en el equipo.
- Al votar, se **marca** que el estudiante ya votó por cada cargo (rep/amb/per) y se **rota** su OTP.
- La boleta se guarda **sin vincular** el DNI (secreto). Solo se registra `mesa_id`, hora, carrera y candidato.
- Hay un **libro de mesa (ledger)** visible en el equipo con hash de auditoría por boleta.
- Admin ve **totales** por cargo y conteos por mesa.

## Archivos clave
- `server.js` — API (Express + SQLite).
- `scripts/init_db.js` — crea e inicializa la base de datos.
- `public/index.html` — formulario de votación para jurados/mesa.
- `public/admin.html` — panel simple de resultados.
- `public/style.css` — estilos.

## Despliegue
- Puedes alojar en Render / Railway (Node) o en una VM. Para Netlify/Vercel, usa función Node o servicio externo para el server.
- Copia el repo, ejecuta `node scripts/init_db.js` en el servidor antes de abrir el puerto.
