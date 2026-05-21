FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl unzip ca-certificates gnupg awscli \
  && rm -rf /var/lib/apt/lists/*

# Claude Code CLI (SSM OAuth로 인증)
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY prompts ./prompts
COPY resources ./resources
COPY .mcp.json ./

COPY deploy/entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 5011
ENTRYPOINT []
CMD ["/bin/sh", "/app/entrypoint.sh"]
