const http = require('http');
const { URL } = require('url');
const client = require('prom-client');

const port = process.env.PORT || 3000;

// --- Prometheus metrics setup ---
const register = new client.Registry();

// Default Node.js process metrics (CPU, mem, event loop lag, GC, etc.)
client.collectDefaultMetrics({ register });

// App-specific metrics
const httpReqsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'code'],
});
const httpReqDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  // Reasonable buckets for web latency
  buckets: [0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

register.registerMetric(httpReqsTotal);
register.registerMetric(httpReqDuration);

// --- tiny router ---
function routeName(pathname) {
  if (pathname === '/') return 'root';
  if (pathname === '/healthz') return 'healthz';
  if (pathname === '/metrics') return 'metrics';
  return 'not_found';
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const r = routeName(pathname);

  // Start duration timer with partial labels; we'll add status code on finish
  const endTimer = httpReqDuration.startTimer({ method: req.method, route: r });

  // Respond
  try {
    if (r === 'metrics') {
      // Important: set correct content type
      res.statusCode = 200;
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
      httpReqsTotal.inc({ method: req.method, route: r, code: 200 });
      endTimer({ code: 200 });
      return;
    }

    if (r === 'root') {
      res.statusCode = 200;
      res.end('Prostagma?\n');
      httpReqsTotal.inc({ method: req.method, route: r, code: 200 });
      endTimer({ code: 200 });
      return;
    }

    if (r === 'healthz') {
      res.statusCode = 200;
      res.end('ok\n');
      httpReqsTotal.inc({ method: req.method, route: r, code: 200 });
      endTimer({ code: 200 });
      return;
    }

    // 404
    res.statusCode = 404;
    res.end('not found\n');
    httpReqsTotal.inc({ method: req.method, route: r, code: 404 });
    endTimer({ code: 404 });
  } catch (e) {
    // 500
    res.statusCode = 500;
    res.end('internal error\n');
    httpReqsTotal.inc({ method: req.method, route: r, code: 500 });
    endTimer({ code: 500 });
  }
});

// Graceful shutdown (useful in containers)
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}/`);
});