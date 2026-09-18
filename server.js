const http = require('node:http');
const next = require('next');

const port = Number.parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    http.createServer((req, res) => handle(req, res))
      .listen(port, hostname, () => {
        console.log(`> NEBO API ready on http://${hostname}:${port}`);
      });
  })
  .catch((error) => {
    console.error('[server] Failed to start Next.js', error);
    process.exit(1);
  });
