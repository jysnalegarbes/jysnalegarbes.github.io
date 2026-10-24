// @ts-check
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

const fluidConfigPath = fileURLToPath(new URL('./src/config/fluid-trail.json', import.meta.url));

/**
 * Dev-only endpoint behind the fluid tweak panel's "Save to project" button.
 * Accepts only the keys already in the config file, with matching types.
 * @returns {import('vite').Plugin}
 */
function fluidConfigSaver() {
  return {
    name: 'fluid-config-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__fluid-config', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const current = JSON.parse(await readFile(fluidConfigPath, 'utf8'));
            const incoming = JSON.parse(body);
            if (!/^#[0-9a-f]{6}$/i.test(incoming.tint)) throw new Error('tint must be a #rrggbb colour');
            const config = {};
            for (const [key, value] of Object.entries(current.config)) {
              if (typeof incoming.config?.[key] !== typeof value) throw new Error(`config.${key} has the wrong type`);
              config[key] = incoming.config[key];
            }
            await writeFile(fluidConfigPath, JSON.stringify({ tint: incoming.tint, config }, null, 2) + '\n');
            res.statusCode = 204;
            res.end();
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err instanceof Error ? err.message : err));
          }
        });
      });
    },
  };
}

export default defineConfig({
  site: 'https://jysnalegarbes.github.io',
  trailingSlash: 'ignore',
  vite: {
    plugins: [fluidConfigSaver()],
  },
});
