// Local preview server: /project/* from ./project, /_blob/<id> from ./_blob/<id>.*
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, port = Number(process.argv[2] || 8770);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.mp4': 'video/mp4', '.css': 'text/css' };
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let file = null;
  if (u.startsWith('/_blob/')) {
    const id = u.slice(7);
    const hit = fs.readdirSync(path.join(root, '_blob')).find((f) => f.startsWith(id));
    if (hit) file = path.join(root, '_blob', hit);
  } else file = path.join(root, u);
  if (!file || !file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  const data = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  // byte ranges so <video> can seek
  const range = req.headers.range;
  if (range && (ext === '.mp4' || ext === '.webm')) {
    const m = /bytes=(\d*)-(\d*)/.exec(range); const start = Number(m[1] || 0); const end = m[2] ? Number(m[2]) : data.length - 1;
    res.writeHead(206, { 'Content-Type': types[ext], 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    res.end(data.subarray(start, end + 1)); return;
  }
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes' }); res.end(data);
}).listen(port, () => console.log('serving on', port));
