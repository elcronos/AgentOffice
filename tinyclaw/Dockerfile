FROM node:20-slim

# Install build dependencies + gosu for privilege dropping at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    git python3 make g++ ca-certificates curl gosu && \
    rm -rf /var/lib/apt/lists/*

# Clone tinyclaw source
RUN git clone --depth=1 https://github.com/TinyAGI/tinyclaw.git /app/tinyclaw

# Build tinyclaw
WORKDIR /app/tinyclaw
RUN npm install && npm run build

# Patch invoke.js: pass --system-prompt from prompt_file when invoking the claude CLI.
# tinyclaw stores prompt_file in agent config but never forwards it to the CLI;
# this patch injects it so each agent uses its own persona instead of Claude Code defaults.
RUN node -e " \
const fs = require('fs'); \
const p = 'dist/lib/invoke.js'; \
let c = fs.readFileSync(p, 'utf8'); \
const needle = \"claudeArgs.push('-p', message);\"; \
const inject = \" \
        if (agent.prompt_file && fs_1.default.existsSync(agent.prompt_file)) { \
            const sp = fs_1.default.readFileSync(agent.prompt_file, 'utf8').trim(); \
            claudeArgs.push('--system-prompt', sp); \
        } \
\"; \
if (!c.includes('--system-prompt')) { \
    c = c.replace(needle, inject + needle); \
    fs.writeFileSync(p, c); \
    console.log('invoke.js patched: --system-prompt support added'); \
} else { console.log('invoke.js already patched'); } \
"

# Install Claude Code CLI (provides the `claude` binary used by the anthropic provider)
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user for Claude CLI (--dangerously-skip-permissions blocked as root)
RUN useradd -m -s /bin/bash tinyclaw

# Create required directories; /shared ownership is fixed at runtime by entrypoint
RUN mkdir -p /tinyclaw-workspace /app/prompts /app/config /home/tinyclaw/.tinyclaw && \
    chown -R tinyclaw:tinyclaw /tinyclaw-workspace /app/prompts /app/config \
                                /home/tinyclaw/.tinyclaw /app/tinyclaw

# Copy config and entrypoint
COPY settings.json /app/config/settings.json
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && \
    chown tinyclaw:tinyclaw /app/config/settings.json

# Container stays as root so entrypoint can fix volume permissions;
# gosu is used to drop to tinyclaw before starting node/claude processes.

EXPOSE 3777

ENTRYPOINT ["/entrypoint.sh"]
