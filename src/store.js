// Stockage simple des prospects dans un fichier JSON.
// Suffisant pour démarrer (faible volume). Pour passer à l'échelle,
// remplacer ce module par une vraie base (Postgres/Supabase) en gardant
// la même interface (addLead / getLeads).

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'leads.json');

function readAll() {
  if (!fs.existsSync(DB_PATH)) return [];
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Erreur de lecture de leads.json, fichier ignoré :', err.message);
    return [];
  }
}

function writeAll(leads) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(leads, null, 2), 'utf8');
}

function addLead(lead) {
  const leads = readAll();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    createdAt: new Date().toISOString(),
    status: 'nouveau',
    ...lead
  };
  leads.unshift(entry);
  writeAll(leads);
  return entry;
}

function getLeads() {
  return readAll();
}

module.exports = { addLead, getLeads };
