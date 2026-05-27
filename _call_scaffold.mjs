import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fs from "fs";

const MCP_URL = "http://mcp-agents-staging-alb-249976027.us-east-1.elb.amazonaws.com:5011/mcp";

const client = new Client({ name: "scaffold-trigger", version: "0.1.0" });
const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
await client.connect(transport);

console.log("=== tools available ===");
const { tools } = await client.listTools();
console.log(tools.map(t => t.name).join("\n"));

const TASK = process.argv[2] || "유저 API: 회원가입/로그인. NestJS 부트스트랩(main.ts, app.module, Swagger, ValidationPipe, exception filter), TypeORM 데이터소스, users 엔티티(uuid id, email unique, passwordHash, name), auth 모듈(POST /api/auth/signup, POST /api/auth/login), JWT 가드, DTO+class-validator, Dockerfile(NestJS 빌드용), package.json(NestJS 10 deps), tsconfig, nest-cli.json. 04-data-layer.md의 RDS 정보 사용. health controller 포함.";

console.log("\n=== calling scaffold_new_project_api ===");
const t0 = Date.now();
const r = await client.callTool(
  {
    name: "scaffold_new_project_api",
    arguments: {
      task: TASK,
    },
  },
  undefined,
  { timeout: 600000, resetTimeoutOnProgress: true, maxTotalTimeout: 900000 },
);
console.log(`(${Date.now() - t0}ms)`);
const out = r.content[0].text;
fs.writeFileSync("/tmp/scaffold_out.json", out);
console.log("\n=== output saved to /tmp/scaffold_out.json ===");
console.log("first 500 chars:", out.slice(0, 500));

await client.close();
