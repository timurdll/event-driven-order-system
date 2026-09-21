'use strict';

const http = require('http');

function startHealthServer(port, serviceName) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: serviceName }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    console.log(`${serviceName}: health server listening on port ${port}`);
  });

  return server;
}

module.exports = { startHealthServer };
