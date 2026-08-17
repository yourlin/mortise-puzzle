import { defineConfig } from 'vitest/config';

// 独立于 vite.config.ts —— 那份的 root 指向 demo/，会让 vitest 找不到测试
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
