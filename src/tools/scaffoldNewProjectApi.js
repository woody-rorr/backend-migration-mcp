import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { runClaude } from "../clients/claudeCli.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

let _systemCache = null;
async function buildSystem() {
  if (_systemCache) return _systemCache;
  const sections = [
    "# 역할",
    "당신은 NestJS(TypeScript) 기반 신규 API 서버를 생성하는 전문 에이전트입니다.",
    "원본 레거시 코드(backend-lol-api-v3, backend-migration 등)는 절대 참조하지 않습니다.",
    "이 system prompt에 포함된 new-project 문서(.md)만이 진실의 원천입니다.",
    "",
    "# 절대 규칙",
    "1. 출력은 raw JSON 한 덩어리만. 펜스/주석/사과 텍스트 금지.",
    "2. 스키마: { \"files\": { \"<상대경로>\": \"<파일 전체 내용>\" } }",
    "3. 프레임워크: NestJS 10.x + TypeScript 5.x + Node 20.",
    "4. 디렉토리 구조는 01-stack-and-deploy.md의 §2 규약을 그대로 따른다.",
    "5. 응답/에러 포맷은 03-api-contract.md §1을 따른다. 임의 변형 금지.",
    "6. 모든 입력은 DTO + class-validator로 검증. raw body 수신 금지.",
    "7. DB 접근은 04-data-layer.md의 ORM 선택과 네이밍 규약을 따른다 (TBD인 경우 TypeORM 기본).",
    "8. env 변수는 07-env-and-secrets.md 표에 정의된 것만 사용.",
    "9. .md 문서에 명시되지 않은 엔드포인트/엔티티는 생성하지 않는다. 누락된 정보는 출력 JSON에 'todo' 키로 별도 표기.",
    "10. add/commit/push/PR은 GitHub MCP가 담당 — 본 툴은 파일 생성만.",
    "11. 호출 단위 정책(critical): scaffold_module.md §0의 scope 중 정확히 1개만 생성. 여러 scope 요청 시 첫 번째만 만들고 나머지는 todo에 'next: <scope>' 형식으로 기록. 산출 파일 수 10개 초과 금지 — 초과분은 다음 호출로 미룸.",
    "",
    "# 출력 예시",
    "{ \"files\": { \"src/main.ts\": \"...\", \"src/app.module.ts\": \"...\", \"src/modules/<feature>/<feature>.controller.ts\": \"...\" }, \"todo\": [\"02-domain-model.md: TBD entity X\"] }",
    "",
    "# new-project 문서 (진실의 원천)",
  ];
  async function walk(dir, relParts) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const next = path.join(dir, e.name);
      const relNext = [...relParts, e.name];
      if (e.isDirectory()) await walk(next, relNext);
      else if (e.isFile() && e.name.endsWith(".md")) {
        const text = await fs.readFile(next, "utf8");
        sections.push(`## ${relNext.join("/")}`, text, "");
      }
    }
  }
  await walk(path.join(ROOT, "resources/new-project"), ["resources/new-project"]);
  await walk(path.join(ROOT, "prompts/new-project"), ["prompts/new-project"]);
  _systemCache = sections.join("\n");
  return _systemCache;
}

export function registerScaffoldNewProjectApi(server) {
  server.tool(
    "scaffold_new_project_api",
    "new-project 도메인의 NestJS API 코드를 생성. 한 번 호출 = scaffold_module.md §0의 scope 1개만(파일 10개 이하). 여러 scope가 필요한 작업이면 호출자는 첫 호출의 todo['next: ...']를 보고 후속 호출을 자동으로 이어가야 함. resources/new-project/*.md 명세만 보고 작성하며, 기존 레거시 코드는 참조하지 않음. 결과는 files 맵 — add/commit/push/PR은 GitHub MCP가 담당.",
    {
      task: z
        .string()
        .describe("생성/수정할 범위. 예: 'bootstrap skeleton', '<feature> module', 'health controller only'."),
      extra_spec: z
        .string()
        .optional()
        .describe("docs에 아직 반영되지 않은 임시 명세(엔티티/엔드포인트 등). 사용 후에는 docs로 승격 필요."),
      target_paths: z
        .string()
        .optional()
        .describe("출력 파일 경로 화이트리스트(콤마 구분). 비우면 task 범위에 맞춰 자동 결정."),
    },
    async ({ task, extra_spec, target_paths }) => {
      try {
        const system = await buildSystem();
        const user = [
          `# task\n${task}`,
          extra_spec ? `# extra_spec (docs에 아직 없음)\n${extra_spec}` : null,
          target_paths ? `# target_paths\n${target_paths}` : null,
        ].filter(Boolean).join("\n\n");
        const text = await runClaude({ system, user });
        return { content: [{ type: "text", text }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error in scaffold_new_project_api: ${e.message}` }] };
      }
    }
  );
}
