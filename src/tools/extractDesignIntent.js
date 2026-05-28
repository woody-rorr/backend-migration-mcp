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
    "당신은 사용자 발화 + (선택) stitch 디자인 IR을 읽고, 신규 NestJS API 프로젝트의 도메인 명세 JSON을 산출하는 추출기입니다.",
    "코드는 생성하지 않습니다. 명세 JSON만 반환합니다.",
    "",
    "# 절대 규칙",
    "1. 출력은 raw JSON 한 덩어리만. 펜스/주석/사과 텍스트 금지.",
    "2. 스키마는 design.md §5를 정확히 따른다.",
    "3. design.md §3 항목(비즈니스 규칙·권한·갱신 주기 등)은 디자인/발화에 단서가 없으면 절대 추측하지 말고 `open_questions`로 반환한다.",
    "4. placeholder 이름(`posts`, `items`, `examples`, `things`, `entries`, `records`, `samples`, `data`, `resource`) 사용 금지.",
    "5. 사용자 발화/디자인에 등장하지 않는 엔티티 추가 금지.",
    "6. `confidence < 0.8` 이면 `open_questions`에 부족분을 메우는 질문을 1개 이상 포함.",
    "7. 한글 도메인 용어는 design.md §7 정규화 규칙으로 영문 단일어 변환.",
    "",
    "# design.md (가이드 본문)",
  ];
  const designMd = await fs.readFile(
    path.join(ROOT, "prompts/new-project/design.md"),
    "utf8"
  );
  sections.push(designMd, "");
  sections.push("# 공통 규약 참고 (resources/new-project)");
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
  _systemCache = sections.join("\n");
  return _systemCache;
}

export function registerExtractDesignIntent(server) {
  server.tool(
    "extract_design_intent",
    "사용자 발화 + (선택) stitch 디자인 IR → 신규 프로젝트 도메인 명세 JSON. 코드 생성은 하지 않음. `scaffold_new_project_api`의 `extra_spec` 입력으로 사용. `open_questions`가 남아있으면 호출자가 사용자에게 질문 후 `clarifications`로 묶어 재호출.",
    {
      utterance: z
        .string()
        .describe("사용자 발화. 예: '게임 만들어줘', 'e스포츠 뉴스 피드 만들어줘'."),
      design_ir: z
        .string()
        .optional()
        .describe("stitch 디자인 IR을 직렬화한 텍스트(JSON 문자열 또는 마크다운). screen/component/label/form field 정보 포함."),
      clarifications: z
        .string()
        .optional()
        .describe("이전 라운드의 `open_questions`에 대한 사용자 답변. JSON 문자열 권장 — { '<question_id>': '<answer>' }."),
    },
    async ({ utterance, design_ir, clarifications }) => {
      try {
        const system = await buildSystem();
        const user = [
          `# utterance\n${utterance}`,
          design_ir ? `# design_ir\n${design_ir}` : null,
          clarifications ? `# clarifications (이전 라운드 답변)\n${clarifications}` : null,
        ].filter(Boolean).join("\n\n");
        const text = await runClaude({ system, user });
        return { content: [{ type: "text", text }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error in extract_design_intent: ${e.message}` }] };
      }
    }
  );
}
