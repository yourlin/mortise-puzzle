import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * 样式不被任何 JS 入口 import（库惯例是让使用方显式引入
 * 'mortise-puzzle/styles.css'），所以打包完直接搬过去。
 */
const copyStyles = (): Plugin => ({
  name: 'copy-styles',
  closeBundle() {
    copyFileSync(r('./src/react/styles.css'), r('./dist/styles.css'));
  },
});

/**
 * npm 包的构建配置。两个入口：
 *   mortise-puzzle        → 切割算法，零依赖、不碰 DOM
 *   mortise-puzzle/react  → React 渲染层，react 走 peerDependency
 *   mortise-puzzle/vue    → Vue 3 渲染层，vue 走 peerDependency
 * 类型声明由 `tsc -p tsconfig.lib.json` 在此之后生成（见 build:lib）。
 */
export default defineConfig({
  plugins: [react(), copyStyles()],
  build: {
    lib: {
      entry: {
        index: r('./src/index.ts'),
        'react/index': r('./src/react/index.ts'),
        'vue/index': r('./src/vue/index.ts'),
      },
      formats: ['es', 'cjs'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'vue'],
      output: [
        {
          format: 'es',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
        },
        {
          // 老 Node 脚本、jest 默认环境这类 CJS 消费方也能 require 进来
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: 'chunks/[name]-[hash].cjs',
          exports: 'named',
        },
      ],
    },
  },
});
