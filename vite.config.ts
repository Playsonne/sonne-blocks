import { defineConfig, loadEnv } from 'vite';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Generate a complete, versioned precache from the actual output (including hashed assets).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appVersion = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version as string;
  let outputDirectory = resolve('dist');
  return {
    base: env.VITE_BASE_PATH || './',
    plugins: [{
      name: 'sonne-version',
      transformIndexHtml(html, context) {
        return html.replaceAll('__APP_VERSION__', appVersion).replaceAll('__APP_BUILD__', context.server ? 'dev' : '__APP_BUILD__');
      },
    }, {
      name: 'sonne-offline',
      apply: 'build',
      configResolved(config) { outputDirectory = resolve(config.root, config.build.outDir); },
      closeBundle() {
        const root = outputDirectory;
        const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
        const assets = files(root).filter(path => !path.endsWith('sw.js')).sort();
        const version = createHash('sha256');
        for (const path of assets) { version.update(relative(root, path)); version.update(readFileSync(path)); }
        const template = readFileSync(resolve('src/service-worker.js'), 'utf8');
        version.update(template);
        // Hash with the label's placeholder still present to avoid a self-referential ID.
        // Embed the cache version in its own HTML, never fetch the newest label separately.
        const buildId = version.digest('hex').slice(0, 16);
        const htmlPath = join(root, 'index.html');
        writeFileSync(htmlPath, readFileSync(htmlPath, 'utf8').replaceAll('__APP_BUILD__', buildId.slice(0, 7)));
        writeFileSync(join(root, 'sw.js'), template.replace('__VERSION__', buildId).replace('__ASSETS__', JSON.stringify(assets.map(path => './' + relative(root, path).replaceAll('\\', '/')))));
      },
    }],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
