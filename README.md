# 🏢 AgentOffice

A 2D office simulation where AI agents powered by [tinyclaw](https://github.com/TinyAGI/tinyclaw) work at their desks. Chat with agents, assign projects, and watch them collaborate in real time.

## Features

- **2D Office Game** — Top-down office view with animated agent desks
- **Live Agent Statuses** — IDLE, PLANNING, WORKING with visual indicators
- **Real-time Chat** — WebSocket-powered conversations with individual agents or general chat
- **Project Management** — Create projects, assign agents, and auto-brief the CEO
- **Notifications** — Bell icon with toast alerts when agents respond
- **Skills System** — Install tinyclaw built-in skills or custom GitHub skills per agent
- **Hot-reload Config** — Update API keys and agent prompts without rebuilding
- **Fully Dockerized** — One command to run everything

## Quick Start

### 1. Clone & configure

```bash
git clone https://github.com/elcronos/AgentOffice
cd AgentOffice
cp .env.example .env
# Edit .env and add your API key
```

### 2. Launch

```bash
./launch.sh
```

The launcher checks prerequisites, starts all containers, waits for health checks, and opens the app automatically.

```bash
./launch.sh --rebuild   # force image rebuild (required after code changes)
./launch.sh --logs      # tail live logs after starting
./launch.sh --stop      # stop all containers
```

### 3. Open the UI

Navigate to **http://localhost:3000**

If you didn't set an API key in `.env`, click **Settings** in the top-right corner to configure it from the UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Docker Compose                         │
│                                                             │
│  ┌──────────────────┐   WebSocket/HTTP   ┌───────────────┐  │
│  │    Frontend       │◄─────────────────►│    Backend    │  │
│  │ React 18 + Vite   │                   │   FastAPI     │  │
│  │ Tailwind CSS      │                   │   port 8000   │  │
│  │ 2D Office Game    │                   └──────┬────────┘  │
│  │ port 3000 (nginx) │                          │ HTTP      │
│  └──────────────────┘                   ┌───────▼────────┐  │
│                                         │   tinyclaw     │  │
│                                         │  Node.js daemon│  │
│                                         │  Claude CLI    │  │
│                                         │  port 3777     │  │
│                                         └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- **Frontend** — React 18 + TypeScript + Vite, Tailwind CSS, 2D office game, WebSocket client
- **Backend** — FastAPI, WebSocket hub, agent state, HTTP adapter to tinyclaw, projects & notifications API
- **tinyclaw** — Node.js AI engine, SQLite-backed message queue, invokes `claude` CLI per agent

## Agents

| Agent | Role | Specialty |
|-------|------|-----------|
| 👔 Alex CEO | Chief Executive Officer | Strategy, scope clarification, project kickoff |
| 💻 Sam Dev | Senior Developer | Code, architecture, debugging |
| 🎨 Maya Design | UX/UI Designer | Design systems, user experience, wireframes |
| 📋 Jordan PM | Project Manager | Planning, coordination, timelines |

Agent system prompts live in `backend/prompts/{agent_id}.md` and are hot-reloadable via the UI or API.

## Configuration

Copy `.env.example` to `.env` and set the relevant key:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude models) |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `TINYCLAW_MODEL` | Model identifier (default: `claude-sonnet-4-6`) |
| `TINYCLAW_PROVIDER` | Provider: `anthropic`, `openai`, or `openrouter` |

API keys can also be set or changed at runtime via the Settings panel — no rebuild needed.

## Development

Run services individually without Docker:

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # → http://localhost:5173
```

tinyclaw requires Docker (it clones and builds from source at image build time).

## Useful Commands

```bash
# View live logs
docker compose logs -f

# tinyclaw logs only
docker compose logs -f tinyclaw

# Check health endpoints
curl http://localhost:8000/api/health
curl http://localhost:3777/api/queue/status

# Rebuild after code changes
./launch.sh --rebuild
```
