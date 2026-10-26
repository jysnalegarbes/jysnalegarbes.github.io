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

const portraitConfigPath = fileURLToPath(new URL('./src/config/portrait-expand.json', import.meta.url));

/**
 * Keeps `incoming` to exactly the shape of `current`: same keys, numbers
 * where it has numbers (nested objects allowed). Throws otherwise.
 * @param {any} current @param {any} incoming @param {string} path
 * @returns {any}
 */
function sameShape(current, incoming, path = '') {
  if (typeof current === 'number') {
    if (typeof incoming !== 'number' || !Number.isFinite(incoming)) throw new Error(`${path.slice(0, -1)} must be a number`);
    return incoming;
  }
  /** @type {Record<string, any>} */
  const out = {};
  for (const [key, value] of Object.entries(current)) {
    if (typeof incoming?.[key] === 'undefined') throw new Error(`${path}${key} is missing`);
    out[key] = sameShape(value, incoming[key], `${path}${key}.`);
  }
  return out;
}

/**
 * Dev-only endpoint behind the About portrait tweak panel's "Save to
 * project" button (src/scripts/portrait-tweaks.ts).
 * @returns {import('vite').Plugin}
 */
function portraitConfigSaver() {
  return {
    name: 'portrait-config-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__portrait-config', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const current = JSON.parse(await readFile(portraitConfigPath, 'utf8'));
            const config = sameShape(current, JSON.parse(body));
            await writeFile(portraitConfigPath, JSON.stringify(config, null, 2) + '\n');
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
    plugins: [fluidConfigSaver(), portraitConfigSaver()],
  },
});
