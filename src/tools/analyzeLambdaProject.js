import { z } from "zod";
import { runClaude } from "../clients/claudeCli.js";

export function registerAnalyzeLambdaProject(server) {
  server.tool(
    "analyze_lambda_project",
    "Serverless framework Lambda 프로젝트의 핸들러/라우트 인벤토리를 추출. 입력: serverless.ts 또는 serverless.yml 내용. 출력: route inventory JSON.",
    {
      serverless_config: z.string().describe("serverless.ts 또는 serverless.yml 전체 텍스트"),
      handlers_summary: z.string().optional().describe("핸들러 파일 경로/시그니처 요약 (선택)"),
    },
    async ({ serverless_config, handlers_summary }) => {
      try {
        const system = [
          "당신은 Serverless framework 분석 전문 에이전트입니다.",
          "입력으로 받은 serverless 설정에서 functions/events를 추출해 ECS Express 라우터로 옮기기 위한 라우트 인벤토리를 JSON으로 반환합니다.",
          "출력은 raw JSON 한 덩어리만. 펜스/주석 금지.",
          "스키마: { \"routes\": [{ \"name\": string, \"handler\": string, \"method\": string, \"path\": string, \"auth\": string|null }] }",
        ].join("\n");
        const user = [
          "## serverless 설정",
          serverless_config,
          handlers_summary ? `\n## 핸들러 요약\n${handlers_summary}` : "",
        ].join("\n");
        const text = await runClaude({ system, user });
        return { content: [{ type: "text", text }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error in analyze_lambda_project: ${e.message}` }] };
      }
    }
  );
}
