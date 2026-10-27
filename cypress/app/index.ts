import express, { type Request, type Response, json, raw } from 'express';
import minimist from 'minimist';
import { WebSocketServer, type WebSocket } from 'ws';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { setInterval, clearInterval } from 'node:timers';

const app = express();
const ws = new WebSocketServer({ noServer: true, path: '/ws' });

// get port from passed in args from scripts/start.js
const { port } = minimist(process.argv.slice(2));

app.use('/assets', express.static(join(import.meta.dirname, 'assets')));
app.use('/', express.static(join(import.meta.dirname, 'public')));

app.set('views', join(import.meta.dirname, 'views'));
app.set('view engine', 'hbs');

const wsDispatcher = (socket: WebSocket) => {
  const data = `This is a message at time ${Date.now()}`;

  socket.send(data);
};
ws.on('connection', socket => {
  const timer = setInterval(() => wsDispatcher(socket), 100);
  wsDispatcher(socket);
  socket.once('close', () => clearInterval(timer));
});

app.get('/', (_: Request, res: Response) =>
  res.render('./index.hbs', {
    pages: [
      { id: 'fetch', name: 'Fetch' },
      { id: 'frame', name: 'Frame' },
      { id: 'service-worker', name: 'Service worker' },
      { id: 'worker', name: 'Workers (Shared and Web)' },
      { id: 'multi-targets', name: 'Multi targets' },
      { id: 'server-sent-events', name: 'Server-sent events' },
      { id: 'websocket', name: 'WebSocket' },
      { id: 'large-content', name: 'Large content' },
      { id: 'large-body', name: 'Large body' },
      { id: 'post-data', name: 'Post data' }
    ]
  })
);
app.get('/pages/:page', (req: Request, res: Response) =>
  res.render(`./${req.params.page}.hbs`)
);
const sseDispatcher = (res: Response) => {
  const data = `data: This is a message at time ${Date.now()}\n\n`;

  res.write(data);
};
app.get('/api/events', (req: Request, res: Response) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',

    'Cache-Control': 'no-cache'
  };
  res.writeHead(200, headers);
  const timer = setInterval(() => sseDispatcher(res), 100);
  sseDispatcher(res);
  req.on('close', () => clearInterval(timer));
});
app.post('/api/math', json(), (req: Request, res: Response) => {
  const { args, op }: { args: number[]; op: string } = req.body;

  switch (op) {
    case 'sum':
      return res.json(args.reduce((a: number, b: number) => a + b));
    case 'divide':
      return res.json(args.reduce((a: number, b: number) => Math.round(a / b)));
    default:
      return res.sendStatus(400);
  }
});
app.get('/api/products', (_: Request, res: Response) =>
  res.json({
    products: [
      { name: 'Cheese', price: 2.5, location: 'Refrigerated foods' },
      { name: 'Crisps', price: 3, location: 'the Snack isle' },
      { name: 'Pizza', price: 4, location: 'Refrigerated foods' },
      { name: 'Chocolate', price: 1.5, location: 'the Snack isle' },
      { name: 'Self-raising flour', price: 1.5, location: 'Home baking' },
      { name: 'Ground almonds', price: 3, location: 'Home baking' }
    ]
  })
);
app.post(
  '/api/echo',
  raw({ type: ['text/xml', 'application/json'] }),
  (req: Request, res: Response) =>
    res.send(Buffer.isBuffer(req.body) ? req.body.toString() : req.body)
);
app.get('/api/random', (_: Request, res: Response) =>
  res.json({ value: randomUUID() })
);
app.get('/api/random-bytes', (_: Request, res: Response) =>
  res.type('application/octet-stream').send(randomBytes(64))
);
app.get('/api/cookies', (_: Request, res: Response) =>
  res.cookie('first', randomUUID()).cookie('second', randomUUID()).json({})
);
app.get('/api/delay/:ms', (req: Request, res: Response) => {
  setTimeout(() => res.json({ delay: req.params.ms }), Number(req.params.ms));
});
app.get('/api/keys', (_: Request, res: Response) =>
  res.json({
    keys: Array(1000)
      .fill(0)
      .map((_noop, idx) => ({
        key: randomBytes(75000).toString('hex'),
        id: idx
      }))
  })
);
const largeBody = randomBytes(25 * 1024 ** 2).toString('hex');
app.get('/api/large-body', (_: Request, res: Response) =>
  res.type('text/plain').send(largeBody)
);

const server = app.listen(port);
server.on('upgrade', (request, socket, head) =>
  ws.handleUpgrade(request, socket, head, client =>
    ws.emit('connection', client, request)
  )
);
