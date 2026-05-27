#!/usr/bin/env node
// claude-output.md 에서 `## <path>` + 다음 코드 블록을 파싱해 파일로 저장
//
// 사용: node parse-output.mjs <input.md> <out-dir>

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, basename, join } from "node:path";

const [, , INPUT, OUT_DIR] = process.argv;
if (!INPUT || !OUT_DIR) {
  console.error("usage: parse-output.mjs <input.md> <out-dir>");
  process.exit(1);
}

const text = readFileSync(INPUT, "utf8");

// 매칭: `## <path>` 헤더 + 직후의 ```...``` 코드 블록 (lang 무시)
const re = /^##\s+(?<path>\S.*?)\s*\n+```[a-zA-Z]*\s*\n(?<code>[\s\S]*?)```/gm;

const files = [];
let m;
while ((m = re.exec(text)) !== null) {
  files.push({ path: m.groups.path.trim(), code: m.groups.code });
}

if (files.length === 0) {
  console.error("✖ 코드 블록을 찾지 못함. claude-output.md 형식 확인 필요.");
  process.exit(2);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const { path, code } of files) {
  // path가 src/domains/<d>/<file>.js 형태일 것으로 가정. basename만 사용.
  const file = basename(path);
  if (!file.endsWith(".js")) continue;
  const out = join(OUT_DIR, file);
  writeFileSync(out, code);
  console.log(`  → ${out} (${code.length} bytes)`);
}
