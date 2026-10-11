import { build, preview, type PreviewServer } from 'vite';

// Own the HTTP servers directly so teardown is reliable on Windows as well as Unix.
export default async function setup() {
  await build({ base: '/TETRIS/', build: { outDir: 'dist-subpath' } });
  const servers: PreviewServer[] = [];
  const close = async () => {
    await Promise.all(servers.map(server => new Promise<void>((resolve, reject) => {
      server.httpServer.closeAllConnections();
      server.httpServer.close(error => error ? reject(error) : resolve());
    })));
  };
  try {
    servers.push(await preview({ base: './', preview: { port: 4283, host: '127.0.0.1', strictPort: true } }));
    servers.push(await preview({ base: '/TETRIS/', build: { outDir: 'dist-subpath' }, preview: { port: 4284, host: '127.0.0.1', strictPort: true } }));
    return close;
  } catch (error) { await close(); throw error; }
}
