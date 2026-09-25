import { createServer } from 'node:http';

// Benchmark/demo transport. Serialized writes with a bounded queue; each
// response follows persistence, unlike the production queue acknowledgment.
export async function serve(ingest: (raw: string, warmup: boolean) => Promise<number>, port = 0) {
  let tail = Promise.resolve();
  let pending = 0;
  let finish!: () => void;
  const done = new Promise<void>(resolve => { finish = resolve; });
  const server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/finish') {
      await tail;
      res.end('{}'); server.close(() => finish()); return;
    }
    if (req.method !== 'POST' || !req.url?.startsWith('/events')) { res.writeHead(404).end(); return; }
    if (pending >= 16) { res.writeHead(503).end('queue full'); return; }
    pending++;
    try {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 8 * 1024 * 1024) { res.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      const task = tail.then(() => ingest(raw, req.url!.includes('warmup=1')));
      tail = task.then(() => {}, () => {});
      const count = await task;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ persisted: count }));
    } catch (error) { res.writeHead(500).end(String(error)); }
    finally { pending--; }
  });
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing listen address');
  return { url: `http://127.0.0.1:${address.port}`, done };
}
