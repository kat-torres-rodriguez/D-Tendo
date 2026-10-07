// Servidor local solo para probar la app en el computador (GitHub Pages no lo necesita).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const root = process.cwd();
// Con --demo se ignora la configuración de Firebase (datos solo en el navegador).
const demo = process.argv.includes('--demo');
http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^[\\/]+/, '');
  if (demo && path.replace(/\\/g, '/') === 'js/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    return res.end('export const firebaseConfig = {};');
  }
  try {
    const file = join(root, path || 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(data);
  } catch { res.writeHead(404); res.end('No encontrado'); }
}).listen(demo ? 5174 : 5173, () => console.log(`Casa Quest en http://localhost:${demo ? 5174 : 5173}${demo ? ' (modo demo)' : ''}`));
