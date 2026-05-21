import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import { registerAnalyzeLambdaProject } from "./tools/analyzeLambdaProject.js";
import { registerConvertHandlers } from "./tools/convertHandlers.js";
import { registerGenerateDockerAssets } from "./tools/generateDockerAssets.js";
import { requestStorage, extractBearer } from "./requestContext.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = parseInt(process.env.PORT || "5011", 10);

function listMd(dir) {
  try {
    return fs.readdirSync(path.join(ROOT, dir))
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ name: f, full: path.join(ROOT, dir, f), uri: `file:///${dir}/${f}` }));
  } catch { return []; }
}

function createServer() {
  const server = new McpServer({ name: "backend-migration-mcp", version: "0.1.0" });

  for (const dir of ["resources", "prompts"]) {
    for (const { name, full, uri } of listMd(dir)) {
      server.resource(
        `${dir}/${name}`,
        uri,
        { description: `${dir} document: ${name}`, mimeType: "text/markdown" },
        async () => ({ contents: [{ uri, mimeType: "text/markdown", text: fs.readFileSync(full, "utf8") }] })
      );
    }
  }

  registerAnalyzeLambdaProject(server);
  registerConvertHandlers(server);
  registerGenerateDockerAssets(server);

  return server;
}

const app = express();
app.use(express.json({ limit: "10mb" }));

const transports = new Map();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (sid) => { transports.set(sid, transport); },
    });
    transport.onclose = () => { if (transport.sessionId) transports.delete(transport.sessionId); };
    const server = createServer();
    await server.connect(transport);
  }

  const userToken = extractBearer(req);
  await requestStorage.run({ userToken }, () => transport.handleRequest(req, res, req.body));
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) return res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method Not Allowed" }, id: null });
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) return res.status(404).end();
  await transport.handleRequest(req, res);
});

app.get("/health", (_, res) => res.json({ status: "ok", server: "backend-migration-mcp" }));

app.listen(PORT, () => process.stdout.write(`backend-migration-mcp running on :${PORT}\n`));
