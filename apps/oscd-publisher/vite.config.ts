/// <reference types="vitest" />
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const sclLibNsdJson = path.resolve(
  __dirname,
  '../../node_modules/@openenergytools/scl-lib/dist/foundation/nsd.json',
);

/** scl-lib fetches `../foundation/nsd.json` via import.meta.url. Prebundling
 *  rewrites that URL onto the Vite HTML fallback (`<!doctype ...>`). */
function serveSclLibNsdJson(): Plugin {
  const sendNsd = (
    req: { url?: string },
    res: {
      setHeader: (k: string, v: string) => void;
      end: (b: string | Buffer) => void;
    },
    next: () => void,
  ) => {
    const url = req.url?.split('?')[0] ?? '';
    if (!url.includes('foundation/nsd.json')) {
      next();
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(fs.readFileSync(sclLibNsdJson));
  };

  return {
    name: 'serve-scl-lib-nsd-json',
    configureServer(server) {
      server.middlewares.use(sendNsd);
    },
    configurePreviewServer(server) {
      server.middlewares.use(sendNsd);
    },
  };
}

/** @openenergytools/xml-lib ships ESM without .js extensions. */
function resolveExtensionlessJs(): Plugin {
  return {
    name: 'resolve-extensionless-js',
    enforce: 'pre',
    resolveId(source, importer) {
      if (
        !importer ||
        !importer.includes(`${path.sep}node_modules${path.sep}@openenergytools`) ||
        !source.startsWith('.') ||
        path.extname(source)
      ) {
        return null;
      }
      const resolved = path.resolve(path.dirname(importer), `${source}.js`);
      return fs.existsSync(resolved) ? resolved : null;
    },
  };
}

export default defineConfig(() => {
  const isVitest = Boolean(process.env.VITEST);

  return {
    root: __dirname,
    cacheDir: '../../node_modules/.vite/apps/oscd-publisher',

    server: {
      ...(isVitest
        ? {}
        : {
            port: 4201,
            strictPort: false,
            host: 'localhost',
          }),
      fs: {
        allow: [path.resolve(__dirname, '../..')],
      },
    },

    preview: {
      port: 4301,
      strictPort: false,
      host: 'localhost',
    },

    plugins: [
      serveSclLibNsdJson(),
      resolveExtensionlessJs(),
      nxViteTsPaths(),
    ],

    resolve: {
      dedupe: ['lit', 'lit-html', 'lit-element', '@lit/reactive-element'],
    },

    // scl-lib uses top-level await (nsd.json). Default optimizeDeps target
    // (chrome87) cannot parse it; serve and build must both be es2022+.
    // Do not prebundle scl-lib: that rewrites import.meta.url so nsd.json 404s.
    esbuild: {
      target: 'es2022',
    },
    optimizeDeps: {
      exclude: ['@openenergytools/scl-lib'],
      esbuildOptions: {
        target: 'es2022',
      },
    },

    build: {
      target: 'es2022',
      outDir: '../../dist/apps/oscd-publisher',
      assetsInlineLimit: 0,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js',
          assetFileNames: (assetInfo) =>
            assetInfo.name || '[name]-[hash][extname]',
        },
      },
      lib: {
        entry: 'src/oscd-publisher.ts',
        formats: ['es'],
        fileName: 'index',
      },
    },

    test: {
      globals: true,
      setupFiles: ['src/vitest.setup.ts'],
      server: {
        deps: {
          inline: [
            '@openenergytools/xml-lib',
            '@openenergytools/open-scd-core',
            '@openenergytools/scl-lib',
            '@openenergytools/filterable-lists',
            '@open-wc/scoped-elements',
            '@scopedelement/material-web',
          ],
        },
      },
      environment: 'jsdom',
      cache: {
        dir: '../../node_modules/.vitest',
      },
      include: ['src/**/*.spec.ts'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: '../../coverage/apps/oscd-publisher',
        provider: 'v8',
      },
    },
  };
});
