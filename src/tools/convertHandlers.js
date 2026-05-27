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
    "당신은 AWS Lambda(Node.js) 핸들러를 Express 라우터 코드로 변환하는 전문 에이전트입니다.",
    "",
    "# 절대 규칙",
    "1. 출력은 raw JSON 한 덩어리만. 펜스/주석/사과 텍스트 금지.",
    "2. 스키마: { \"files\": { \"<상대경로>\": \"<파일 전체 내용>\" } }",
    "3. APIGatewayProxyEvent → req(Express) 매핑: event.pathParameters → req.params, event.queryStringParameters → req.query, JSON.parse(event.body) → req.body, event.headers → req.headers.",
    "4. 반환 매핑: { statusCode, body } → res.status(statusCode).type('json').send(body). body가 이미 JSON.stringify된 문자열이면 그대로 send.",
    "5. AWS SDK·환경변수·import 경로는 그대로 유지. 비즈니스 로직 변형 금지.",
    "6. DB 커넥션은 모듈 전역에서 1회 초기화하고 라우터에서 재사용 (Lambda cold-start 패턴을 ECS warm 프로세스로 변환).",
    "7. CORS/auth 미들웨어는 라우터가 아닌 app 레벨에서 처리한다는 가정 — 핸들러 코드에서 CORS 헤더 직접 세팅은 제거.",
    "",
    "# 출력 예시",
    "{ \"files\": { \"src/routes/match.js\": \"import express from 'express';\\nimport { getMatch } from '../handlers/match.js';\\nconst router = express.Router();\\nrouter.get('/:matchId', async (req, res) => { ... });\\nexport default router;\" } }",
    "",
    "# 회사 컨텍스트",
  ];
  async function walk(dir, relParts) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
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
  // migration 도메인만 로드 — new-project는 별도 툴이 사용.
  for (const sub of ["resources/migration", "prompts/migration"]) {
    await walk(path.join(ROOT, sub), [sub]);
  }
  _systemCache = sections.join("\n");
  return _systemCache;
}

export function registerConvertHandlers(server) {
  server.tool(
    "convert_handlers",
    "Lambda 핸들러 코드(또는 묶음)를 Express 라우터 코드로 변환. 결과는 files 맵으로 반환 — add/commit/push/PR은 GitHub MCP가 담당.",
    {
      route_inventory: z.string().describe("analyze_lambda_project가 만든 route inventory JSON 문자열"),
      handler_sources: z.string().describe("변환 대상 핸들러 파일들의 텍스트 묶음 (파일별 ===FILE: <path>=== 구분자 권장)"),
      target_dir: z.string().default("src/routes").describe("Express 라우터 출력 디렉토리"),
    },
    async ({ route_inventory, handler_sources, target_dir }) => {
      try {
        const system = await buildSystem();
        const user = [
          `# 출력 디렉토리\n${target_dir}`,
          `# route inventory\n${route_inventory}`,
          `# handler sources\n${handler_sources}`,
        ].join("\n\n");
        const text = await runClaude({ system, user });
        return { content: [{ type: "text", text }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error in convert_handlers: ${e.message}` }] };
      }
    }
  );
}
