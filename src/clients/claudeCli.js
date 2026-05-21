// Claude Code CLI를 자식 프로세스로 실행해 LLM 호출.
// 인증: ~/.claude/.credentials.json (entrypoint.sh가 SSM에서 복원).
import { spawn } from "child_process";

const TIMEOUT_MS = parseInt(process.env.CLAUDE_TIMEOUT_MS || "180000", 10);

export function runClaude({ system, user, model, cwd, env }) {
  return new Promise((resolve, reject) => {
    const args = ["-p", user, "--output-format", "json"];
    if (system) args.push("--append-system-prompt", system);
    if (model) args.push("--model", model);
    args.push("--allowedTools", "");
    args.push("--mcp-config", JSON.stringify({ mcpServers: {} }));
    args.push("--strict-mcp-config");

    const child = spawn("claude", args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...(env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`claude CLI timeout (${TIMEOUT_MS}ms)`));
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`claude CLI spawn error: ${e.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`claude exited ${code}: ${stderr || stdout}`));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.type === "result" && parsed.subtype === "success") {
          resolve(parsed.result);
        } else if (typeof parsed.result === "string") {
          resolve(parsed.result);
        } else {
          resolve(stdout);
        }
      } catch {
        resolve(stdout);
      }
    });
  });
}
