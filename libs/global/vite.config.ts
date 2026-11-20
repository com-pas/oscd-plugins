/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/global',

  plugins: [nxViteTsPaths()],

  test: {
    name: 'global-lib',
    globals: true,
    environment: 'happy-dom',
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'dev/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/global',
      provider: 'v8',
    },
  },
});
