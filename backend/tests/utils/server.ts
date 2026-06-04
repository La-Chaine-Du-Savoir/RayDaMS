import { Application } from "oak";

export async function startServer(app: Application) {
  // reserve an ephemeral port (close immediately) and then start Oak on it
  const tempListener = Deno.listen({ port: 0 });
  const addr = tempListener.addr as Deno.NetAddr;
  const port = addr.port;
  tempListener.close();

  const ac = new AbortController();
  // start Oak on the reserved port
  app.listen({ port, signal: ac.signal });

  // small tick to let the server start
  await new Promise((r) => setTimeout(r, 10));

  return {
    url: `http://127.0.0.1:${port}`,
    stop: async () => {
      try {
        ac.abort();
      } catch (_e) {
        // ignore
      }
      // wait a moment for shutdown
      await new Promise((r) => setTimeout(r, 10));
    },
  };
}
