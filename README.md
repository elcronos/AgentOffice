# 🏢 AgentOffice

A 2D office simulation where AI agents powered by [picoclaw](https://github.com/sipeed/picoclaw) work at their desks. Chat with agents, assign tasks, and watch them come to life.

## Features

- **2D Office Game** — Top-down office view with animated agent desks
- **Live Agent Statuses** — IDLE, PLANNING, WORKING with visual indicators
- **picoclaw Agents** — Alex (CEO), Sam (Developer), Maya (Designer), Jordan (Manager)
- **Real-time Chat** — WebSocket-powered chat with any agent
- **Easy Setup** — Configure your API key directly from the UI
- **Fully Dockerized** — Run everything with one command

## Quick Start

### 1. Clone & configure

```bash
git clone <this-repo>
cd AgentOffice
cp .env.example .env
# Edit .env with your API key
```

### 2. Start with Docker Compose

```bash
docker compose up -d --build
```

### 3. Open the UI

Navigate to **http://localhost:3000**

If you didn't set an API key in `.env`, click **"Setup API Key"** in the top-right corner and configure it from the UI.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
│                                                         │
│  ┌─────────────────┐    WebSocket/HTTP    ┌──────────┐  │
│  │   Frontend      │◄──────────────────►│ Backend  │  │
│  │ React + Tailwind│                     │ FastAPI  │  │
│  │  2D Office Game │                     │          │  │
│  │  port: 3000     │                     │ picoclaw │  │
│  └─────────────────┘                     │ (binary) │  │
│                                           │ port:8000│  │
│                                           └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Backend** (`./backend/`):
- FastAPI with WebSocket support
- picoclaw binary compiled from source (Go)
- Each agent message invokes picoclaw in agent mode
- Streams responses back to the UI in real-time

**Frontend** (`./frontend/`):
- React 18 + TypeScript + Vite
- Tailwind CSS for styling
- 2D office game with CSS animations
- WebSocket client for live updates

## Agents

| Agent | Role | Specialty |
|-------|------|-----------|
| 👔 Alex CEO | Chief Executive Officer | Strategy, decisions, business goals |
| 💻 Sam Dev | Senior Developer | Code, architecture, debugging |
| 🎨 Maya Design | UX/UI Designer | Design systems, user experience |
| 📋 Jordan PM | Project Manager | Planning, coordination, timelines |

## Development

Run backend locally:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Run frontend locally:
```bash
cd frontend
npm install
npm run dev  # → http://localhost:5173
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PICOCLAW_API_KEY` | Your LLM API key | — |
| `PICOCLAW_MODEL` | Model identifier | `anthropic/claude-sonnet-4-6` |
| `PICOCLAW_PROVIDER` | Provider name | `anthropic` |

Supported providers: `anthropic`, `openai`, `openrouter`
