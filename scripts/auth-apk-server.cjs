const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || 8080);
const apkPath = path.join(__dirname, '..', 'nebo-auth-test.apk');
const fingerprintPath = path.join(__dirname, '..', 'fingerprints.txt');

function sendFile(req, res, filePath, contentType, fileName) {
  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', contentType);
  if (fileName) res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start <= end && end < stat.size) {
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Content-Length': end - start + 1,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }
  }
  res.setHeader('Content-Length', stat.size);
  res.writeHead(200);
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }
  if (req.url === '/nebo-auth-test.apk') {
    sendFile(req, res, apkPath, 'application/vnd.android.package-archive', 'NEBO-latest-test.apk');
    return;
  }
  if (req.url === '/fingerprints.txt') {
    sendFile(req, res, fingerprintPath, 'text/plain; charset=utf-8', 'NEBO-latest-test-fingerprints.txt');
    return;
  }
  if (req.url === '/' || req.url === '/index.html') {
    const body = [
      'NEBO Android test build',
      '',
      'GET /nebo-auth-test.apk',
      'GET /fingerprints.txt',
      '',
      'Stable test-signed development release. Do not publish to a store.',
    ].join('\n');
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`NEBO APK server listening on ${port}`);
});