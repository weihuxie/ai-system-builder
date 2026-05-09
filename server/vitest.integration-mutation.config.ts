// @ts-nocheck
// Stryker-only integration config: limit test scope to specific spec files
// so mutation runs against only the tests that exercise the target source.
// 跑 30 mutants × 全 69 个 integration tests 是 8h+，scope 到 1 个 spec
// 后单次跑 ~70s，30 mutants ≈ 35min。
//
// 不替换 vitest.config.ts —— 那个是日常 npm test 用的，要跑全部 spec。
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@asb/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    // Stryker 跑 mutation 时，Stryker 在 root 跑 vitest --run，覆盖了 mutate
    // 范围里的 source 才有意义。这个 config 用 include 限定 spec scope，
    // mutation target file 通过 stryker.integration.config.json 的 mutate
    // 字段决定。每次跑前要让 spec ⟷ mutate scope 对得上：
    //
    //   mutate = brand.ts → include = brand-llm.test.ts
    //   mutate = generate.ts → include = chainFailover.test.ts (耗时长，慎用)
    //   mutate = products.ts → include = products.test.ts (耗时长，慎用)
    //
    // 默认装 brand pilot（最快），需要换 target 就改 include + stryker config。
    include: ['tests/routes/brand-llm.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'tests/unit/**'],
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    pool: 'forks',
    forks: { singleFork: true },
    setupFiles: ['tests/helpers/setup.ts'],
  },
});
