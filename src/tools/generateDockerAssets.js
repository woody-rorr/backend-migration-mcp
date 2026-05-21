import { z } from "zod";
import { runClaude } from "../clients/claudeCli.js";

export function registerGenerateDockerAssets(server) {
  server.tool(
    "generate_docker_assets",
    "ECS Fargate 배포용 Dockerfile/entrypoint/task-def 스니펫을 생성. 컨테이너 포트는 5012(API) 또는 호출자가 지정.",
    {
      service_name: z.string().describe("ECS 서비스 이름, 예: backend-migration-api"),
      container_port: z.number().default(5012),
      node_version: z.string().default("20"),
      env_keys: z.array(z.string()).optional().describe("필수 환경변수 키 목록"),
    },
    async ({ service_name, container_port, node_version, env_keys }) => {
      try {
        const system = [
          "당신은 ECS Fargate 배포 설정 전문 에이전트입니다.",
          "출력은 raw JSON 한 덩어리. 스키마: { \"files\": { \"Dockerfile\": \"...\", \"deploy/task-definition.json\": \"...\", \"deploy/entrypoint.sh\": \"...\" } }",
          "Dockerfile은 linux/amd64 Fargate용. node:20-bookworm-slim 베이스. aws-cli 포함(SSM 조회용).",
          "entrypoint.sh는 SSM /<service-name>/* 파라미터에서 DB URL 등 시크릿을 가져와 env에 주입한 뒤 node 프로세스 실행.",
          "task-definition.json은 awsvpc/Fargate, cpu 512, memory 1024, awslogs 드라이버.",
        ].join("\n");
        const user = JSON.stringify({ service_name, container_port, node_version, env_keys: env_keys ?? [] });
        const text = await runClaude({ system, user });
        return { content: [{ type: "text", text }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error in generate_docker_assets: ${e.message}` }] };
      }
    }
  );
}
