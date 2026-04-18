// Uso: node scripts/gen-env-local.mjs <ruta-al-json-sa>
// Genera .env.local con la clave de la service account en base64.
import fs from 'node:fs';
import path from 'node:path';

const keyPath = process.argv[2];
if (!keyPath) {
  console.error('Uso: node scripts/gen-env-local.mjs <ruta-al-json>');
  process.exit(1);
}

const raw = fs.readFileSync(keyPath, 'utf8');
const json = JSON.parse(raw);
const minified = JSON.stringify(json);
const b64 = Buffer.from(minified, 'utf8').toString('base64');

const lines = [
  `# Generado automáticamente desde ${path.basename(keyPath)}`,
  `GEE_SERVICE_ACCOUNT_EMAIL=${json.client_email || ''}`,
  '',
  '# JSON completo de la service account, codificado en base64',
  `GEE_PRIVATE_KEY_JSON_B64=${b64}`,
  '',
];

fs.writeFileSync('.env.local', lines.join('\n'));
console.log('OK: .env.local escrito.');
console.log('  client_email :', json.client_email);
console.log('  project_id   :', json.project_id);
console.log('  b64 length   :', b64.length);
