import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * demo 站点（GitHub Pages）的构建配置。
 * demo 通过包名引用本地源码，所以它同时也是一份「怎么用这个包」的示例。
 */
export default defineConfig({
  root: 'demo',
  base: process.env.PAGES_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^mortise-puzzle\/styles\.css$/, replacement: r('./src/react/styles.css') },
      { find: /^mortise-puzzle\/react$/, replacement: r('./src/react/index.ts') },
      { find: /^mortise-puzzle\/vue$/, replacement: r('./src/vue/index.ts') },
      { find: /^mortise-puzzle$/, replacement: r('./src/index.ts') },
    ],
  },
  build: {
    outDir: r('./dist-demo'),
    emptyOutDir: true,
  },
});
