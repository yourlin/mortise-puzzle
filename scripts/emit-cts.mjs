/**
 * 为 CJS 侧补一份 .d.cts 类型声明。
 *
 * 双格式包只给一份 .d.ts 是不够的：在 node16 / nodenext 解析下，CJS 使用方
 * （package.json 无 "type": "module"，或 .cts 文件）会被 TS 拒绝 ——
 *   TS1479: the referenced file is an ECMAScript module and cannot be imported with 'require'
 * 所以 exports 的 require 分支要指向 .d.cts。类型内容与 ESM 完全相同，
 * 直接复制即可；文件内的相对导入不带扩展名，TS 会自动解析到同名 .d.cts。
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

let count = 0;
for (const file of walk(DIST)) {
  if (!file.endsWith('.d.ts')) continue;
  const cts = file.replace(/\.d\.ts$/, '.d.cts');
  // 去掉 sourceMappingURL：map 文件是给 .d.ts 用的，留着只会指错
  const body = readFileSync(file, 'utf8').replace(/\n?\/\/# sourceMappingURL=.*\.d\.ts\.map\s*$/, '\n');
  writeFileSync(cts, body);
  count++;
}
console.log(`emit-cts: 已生成 ${count} 个 .d.cts`);
