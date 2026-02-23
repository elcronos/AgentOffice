"""
AgentOffice Backend — FastAPI server bridging tinyclaw agents with the UI.
"""
import asyncio
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(title="AgentOffice API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Constants ───────────────────────────────────────────────────────────────

PROMPTS_DIR = Path(__file__).parent / "prompts"
TINYCLAW_URL = os.environ.get("TINYCLAW_URL", "http://tinyclaw:3777")
TINYCLAW_CHANNEL = "agentoffice"
SHARED_DIR = Path("/shared")


def _load_prompt(agent_id: str, fallback: str) -> str:
    """Load agent system prompt from prompts/{agent_id}.md, or use fallback."""
    path = PROMPTS_DIR / f"{agent_id}.md"
    try:
        return path.read_text().strip()
    except FileNotFoundError:
        return fallback


AGENTS: dict[str, dict] = {
    "ceo": {
        "id": "ceo",
        "name": "Alex CEO",
        "role": "Chief Executive Officer",
        "emoji": "👔",
        "color": "#6366f1",
        "system_prompt": _load_prompt("ceo",
            "You are Alex, the CEO of a tech startup. You think strategically, "
            "make high-level decisions, and focus on business goals, vision, and "
            "team alignment. Be concise and action-oriented."
        ),
        "desk_position": {"x": 1, "y": 1},
        "skills": ["web_search", "planning"],
    },
    "developer": {
        "id": "developer",
        "name": "Sam Dev",
        "role": "Senior Developer",
        "emoji": "💻",
        "color": "#22c55e",
        "system_prompt": _load_prompt("developer",
            "You are Sam, a senior software developer. You write clean code, "
            "solve technical problems, debug issues, and architect solutions. "
            "Be precise and use concrete code examples when helpful."
        ),
        "desk_position": {"x": 4, "y": 1},
        "skills": ["web_search", "code_execution"],
    },
    "designer": {
        "id": "designer",
        "name": "Maya Design",
        "role": "UX/UI Designer",
        "emoji": "🎨",
        "color": "#f59e0b",
        "system_prompt": _load_prompt("designer",
            "You are Maya, a creative UX/UI designer. You focus on user experience, "
            "visual design, accessibility, and making products beautiful and intuitive. "
            "Think in terms of user flows, components, and design systems."
        ),
        "desk_position": {"x": 1, "y": 3},
        "skills": ["web_search", "image_search"],
    },
    "manager": {
        "id": "manager",
        "name": "Jordan PM",
        "role": "Project Manager",
        "emoji": "📋",
        "color": "#ec4899",
        "system_prompt": _load_prompt("manager",
            "You are Jordan, an experienced project manager. You coordinate tasks, "
            "track progress, manage timelines, and resolve blockers. "
            "Be organized, proactive, and clear in your communication."
        ),
        "desk_position": {"x": 4, "y": 3},
        "skills": ["web_search", "planning", "task_tracking"],
    },
}

# ─── State ───────────────────────────────────────────────────────────────────

agent_statuses: dict[str, str] = {aid: "IDLE" for aid in AGENTS}
agent_current_task: dict[str, str] = {aid: "" for aid in AGENTS}
chat_history: list[dict] = []
projects: list[dict] = []

_initial_key = (
    os.environ.get("ANTHROPIC_API_KEY") or
    os.environ.get("OPENAI_API_KEY") or
    os.environ.get("OPENROUTER_API_KEY") or
    ""
)
settings: dict = {
    "api_key": _initial_key,
    "model": "claude-sonnet-4-6",
    "provider": "anthropic",
    "configured": bool(_initial_key),
}

connections: list[WebSocket] = []

# ─── Broadcast ───────────────────────────────────────────────────────────────

async def broadcast(message: dict):
    dead = []
    for ws in connections:
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in connections:
            connections.remove(ws)


async def set_status(agent_id: str, status: str, task: str = ""):
    agent_statuses[agent_id] = status
    agent_current_task[agent_id] = task
    await broadcast({
        "type": "agent_status",
        "agent_id": agent_id,
        "status": status,
        "task": task,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def notify(title: str, body: str = "", kind: str = "info", agent_id: str | None = None):
    await broadcast({
        "type": "notification",
        "id": f"notif_{time.time_ns()}",
        "title": title,
        "body": body,
        "kind": kind,        # info | success | warning | error
        "agent_id": agent_id,
        "timestamp": datetime.utcnow().isoformat(),
    })


# ─── tinyclaw helpers ─────────────────────────────────────────────────────────

async def _sync_agents_to_tinyclaw(provider: str, model: str):
    """Retry syncing all agents' provider/model in tinyclaw after config change."""
    for attempt in range(10):
        await asyncio.sleep(3)
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                for agent_id, agent in AGENTS.items():
                    await c.put(
                        f"{TINYCLAW_URL}/api/agents/{agent_id}",
                        json={
                            "provider": provider,
                            "model": model,
                            "system_prompt": agent["system_prompt"],
                        },
                    )
            return  # success
        except Exception as e:
            print(f"[tinyclaw] _sync_agents_to_tinyclaw attempt {attempt+1}/10 failed: {e}")


async def mock_response(agent_id: str, message: str) -> str:
    """Fallback mock response when tinyclaw is not available."""
    await asyncio.sleep(1.5)
    personas = {
        "ceo": f"Strategically speaking, '{message[:40]}' aligns with our Q1 goals. Let's prioritize this and loop in the team for execution.",
        "developer": f"For '{message[:40]}' — I'd architect this with a clean separation: API layer, service layer, and data layer. Here's a quick pseudocode sketch:\n```\nclass Solution:\n    def process(self, input): ...\n```",
        "designer": f"From a UX lens, '{message[:40]}' calls for user research first. I'm thinking a minimal, accessible design with clear visual hierarchy. Let me sketch wireframes.",
        "manager": f"On '{message[:40]}' — I'll create a sprint plan: Research (2d) → Design (3d) → Build (5d) → QA (2d). Assigning owners now.",
    }
    return personas.get(agent_id, f"Understood: {message}")


async def send_to_agent(agent_id: str, message: str, sender: str = "User") -> str:
    """Send a message to a tinyclaw agent and poll for the response."""
    msg_id = f"ao_{time.time_ns()}"
    payload = {
        "message": message,
        "agent": agent_id,
        "sender": sender,
        "senderId": msg_id,
        "channel": TINYCLAW_CHANNEL,
        "messageId": msg_id,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            post_resp = await client.post(f"{TINYCLAW_URL}/api/message", json=payload)
            post_resp.raise_for_status()
    except Exception as e:
        print(f"[tinyclaw] Failed to send message to {agent_id}: {e}")
        return await mock_response(agent_id, message)

    # Poll for the response
    deadline = time.time() + 120
    poll_interval = 1.5
    while time.time() < deadline:
        await asyncio.sleep(poll_interval)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                poll_resp = await client.get(
                    f"{TINYCLAW_URL}/api/responses/pending",
                    params={"channel": TINYCLAW_CHANNEL},
                )
                if poll_resp.status_code != 200:
                    continue
                pending = poll_resp.json()
                if not isinstance(pending, list):
                    pending = pending.get("responses", [])

                for resp in pending:
                    if resp.get("messageId") == msg_id:
                        resp_id = resp.get("id") or resp.get("_id")
                        if resp_id:
                            try:
                                async with httpx.AsyncClient(timeout=5) as ack_client:
                                    await ack_client.post(f"{TINYCLAW_URL}/api/responses/{resp_id}/ack")
                            except Exception:
                                pass
                        return resp.get("message", "[No response]")
        except Exception as e:
            print(f"[tinyclaw] Poll error for {agent_id}: {e}")
            continue

    return "[Agent timed out — please try again]"


# ─── Chat pipeline ────────────────────────────────────────────────────────────

async def handle_chat(agent_id: str, message: str, user: str = "User"):
    user_msg = {
        "id": f"msg_{time.time_ns()}",
        "type": "user",
        "agent_id": agent_id,
        "user": user,
        "text": message,
        "timestamp": datetime.utcnow().isoformat(),
    }
    chat_history.append(user_msg)
    await broadcast({"type": "message", **user_msg})

    await set_status(agent_id, "PLANNING", f"Reading: {message[:30]}…")
    await asyncio.sleep(0.3)
    await set_status(agent_id, "WORKING", f"Responding…")

    try:
        response = await send_to_agent(agent_id, message, user)
    except Exception as e:
        response = f"Sorry, I hit an error: {e}"

    agent_msg = {
        "id": f"msg_{time.time_ns()}",
        "type": "agent",
        "agent_id": agent_id,
        "user": AGENTS[agent_id]["name"],
        "text": response,
        "timestamp": datetime.utcnow().isoformat(),
    }
    chat_history.append(agent_msg)
    await broadcast({"type": "message", **agent_msg})
    await set_status(agent_id, "IDLE", "")

    preview = response[:100] + ("…" if len(response) > 100 else "")
    await notify(
        f"{AGENTS[agent_id]['emoji']} {AGENTS[agent_id]['name']} responded",
        preview,
        kind="info",
        agent_id=agent_id,
    )


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{TINYCLAW_URL}/api/queue/status")
            tc_ok = r.status_code == 200
    except Exception:
        tc_ok = False
    return {"status": "ok", "tinyclaw": tc_ok, "configured": settings["configured"]}


@app.get("/api/tinyclaw/status")
async def tinyclaw_status():
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            queue_resp = await c.get(f"{TINYCLAW_URL}/api/queue/status")
            agents_resp = await c.get(f"{TINYCLAW_URL}/api/agents")
            return {
                "ok": True,
                "queue": queue_resp.json() if queue_resp.status_code == 200 else None,
                "agents": agents_resp.json() if agents_resp.status_code == 200 else None,
            }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/agents/prompts/{agent_id}")
async def get_agent_prompt(agent_id: str):
    if agent_id not in AGENTS:
        return JSONResponse(status_code=404, content={"error": "Agent not found"})
    path = PROMPTS_DIR / f"{agent_id}.md"
    content = path.read_text() if path.exists() else AGENTS[agent_id]["system_prompt"]
    return {"agent_id": agent_id, "content": content, "from_file": path.exists()}


class PromptUpdate(BaseModel):
    content: str


@app.put("/api/agents/prompts/{agent_id}")
async def update_agent_prompt(agent_id: str, body: PromptUpdate):
    """Update an agent's prompt file and hot-reload it into the running config."""
    if agent_id not in AGENTS:
        return JSONResponse(status_code=404, content={"error": "Agent not found"})
    PROMPTS_DIR.mkdir(exist_ok=True)
    path = PROMPTS_DIR / f"{agent_id}.md"
    path.write_text(body.content)
    AGENTS[agent_id]["system_prompt"] = body.content.strip()
    return {"success": True, "agent_id": agent_id}


@app.get("/api/agents")
async def get_agents():
    return [
        {**a, "status": agent_statuses[a["id"]], "current_task": agent_current_task[a["id"]]}
        for a in AGENTS.values()
    ]


@app.get("/api/config")
async def get_config():
    return {
        "model": settings["model"],
        "provider": settings["provider"],
        "configured": settings["configured"],
        "api_key_preview": f"{settings['api_key'][:8]}…" if len(settings["api_key"]) > 8 else "",
    }


class ConfigUpdate(BaseModel):
    api_key: str
    model: Optional[str] = None
    provider: Optional[str] = None


@app.post("/api/config")
async def update_config(body: ConfigUpdate):
    settings["api_key"] = body.api_key
    if body.model:
        settings["model"] = body.model
    provider = body.provider or settings.get("provider", "anthropic")
    settings["provider"] = provider
    settings["configured"] = bool(body.api_key)

    # Write API key to shared volume so tinyclaw can pick it up on restart
    if body.api_key:
        SHARED_DIR.mkdir(exist_ok=True)
        var = {
            "anthropic":  "ANTHROPIC_API_KEY",
            "openai":     "OPENAI_API_KEY",
            "openrouter": "OPENROUTER_API_KEY",
        }.get(provider, "ANTHROPIC_API_KEY")
        (SHARED_DIR / "api.env").write_text(f"export {var}={body.api_key}\n")
        (SHARED_DIR / ".restart").touch()

        # Strip provider prefix from model if present (tinyclaw uses bare model names)
        bare_model = body.model.split("/")[-1] if body.model and "/" in body.model else (body.model or settings["model"])
        asyncio.create_task(_sync_agents_to_tinyclaw(provider, bare_model))

    await broadcast({"type": "config_updated", "configured": settings["configured"]})
    return {"success": True, "configured": settings["configured"]}


@app.get("/api/chat/history")
async def chat_history_endpoint(limit: int = 100):
    return chat_history[-limit:]


@app.post("/api/chat/clear")
async def clear_chat():
    chat_history.clear()
    await broadcast({"type": "history_cleared"})
    return {"success": True}


# ─── Projects ─────────────────────────────────────────────────────────────────

class Project(BaseModel):
    title: str
    description: str
    agent_ids: list[str]
    priority: str = "medium"


@app.get("/api/projects")
async def get_projects():
    return projects


@app.post("/api/projects")
async def create_project(p: Project):
    project = {
        "id": f"proj_{time.time_ns()}",
        "title": p.title,
        "description": p.description,
        "agent_ids": p.agent_ids,
        "priority": p.priority,
        "status": "active",
        "created_at": datetime.utcnow().isoformat(),
    }
    projects.append(project)
    await broadcast({"type": "project_created", "project": project})

    # Build team context for the brief
    team_names = ", ".join(
        AGENTS[a]["name"] for a in p.agent_ids if a in AGENTS
    ) or "unassigned"

    ceo_brief = (
        f"🚀 New project kicked off: **{p.title}** (priority: {p.priority})\n\n"
        f"**Description:** {p.description}\n\n"
        f"**Assigned team:** {team_names}\n\n"
        f"As CEO, please: (1) Clarify the project scope and success criteria, "
        f"(2) identify any open questions or ambiguities the user should address before work begins, "
        f"(3) outline how you'd break this down across the team. "
        f"Ask the user any clarifying questions you need."
    )

    # CEO always handles project kickoff; fall back to first available assigned agent
    if agent_statuses.get("ceo") == "IDLE":
        briefing_agent = "ceo"
    else:
        briefing_agent = next(
            (aid for aid in p.agent_ids if agent_statuses.get(aid) == "IDLE"),
            None,
        )

    if briefing_agent:
        asyncio.create_task(handle_chat(briefing_agent, ceo_brief, "System"))
        await notify(
            f"Project '{p.title}' created",
            f"{AGENTS[briefing_agent]['name']} is reviewing scope and will respond shortly…",
            kind="success",
            agent_id=briefing_agent,
        )
    else:
        await notify(
            f"Project '{p.title}' created",
            "All agents are currently busy — CEO will pick this up when free.",
            kind="warning",
        )

    return project


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    global projects
    projects = [p for p in projects if p["id"] != project_id]
    await broadcast({"type": "project_deleted", "project_id": project_id})
    return {"success": True}


# ─── Skills ───────────────────────────────────────────────────────────────────

TINYCLAW_BUILTIN_SKILLS = [
    {"name": "agent-browser",      "description": "Web browsing & automation — navigates URLs, reads page content", "repo": "TinyAGI/tinyclaw", "path": ".agents/skills/agent-browser"},
    {"name": "imagegen",           "description": "Image generation from text descriptions", "repo": "TinyAGI/tinyclaw", "path": ".agents/skills/imagegen"},
    {"name": "schedule",           "description": "Set up timed and recurring tasks", "repo": "TinyAGI/tinyclaw", "path": ".agents/skills/schedule"},
    {"name": "send-user-message",  "description": "Let agents proactively message the user", "repo": "TinyAGI/tinyclaw", "path": ".agents/skills/send-user-message"},
    {"name": "skill-creator",      "description": "Meta-skill: helps agents create new skills", "repo": "TinyAGI/tinyclaw", "path": ".agents/skills/skill-creator"},
]
SKILLS_MANIFEST_FILE = PROMPTS_DIR / "skills_manifest.json"


def load_skills_manifest() -> dict:
    try:
        return json.loads(SKILLS_MANIFEST_FILE.read_text())
    except Exception:
        return {aid: [] for aid in AGENTS}


def save_skills_manifest(manifest: dict):
    PROMPTS_DIR.mkdir(exist_ok=True)
    SKILLS_MANIFEST_FILE.write_text(json.dumps(manifest, indent=2))


async def _append_skill_to_agent(agent_id: str, skill_name: str, skill_content: str):
    """Append skill content to agent prompt file and sync to tinyclaw."""
    prompt_path = PROMPTS_DIR / f"{agent_id}.md"
    current = prompt_path.read_text() if prompt_path.exists() else AGENTS[agent_id]["system_prompt"]
    updated = current.rstrip() + f"\n\n---\n## Skill: {skill_name}\n{skill_content}"
    PROMPTS_DIR.mkdir(exist_ok=True)
    prompt_path.write_text(updated)
    AGENTS[agent_id]["system_prompt"] = updated.strip()
    # Sync to running tinyclaw instance
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            await c.put(
                f"{TINYCLAW_URL}/api/agents/{agent_id}",
                json={"system_prompt": updated.strip()},
            )
    except Exception as e:
        print(f"[tinyclaw] Failed to sync skill to agent {agent_id}: {e}")


@app.get("/api/skills/builtin")
async def get_builtin_skills():
    return {"skills": TINYCLAW_BUILTIN_SKILLS}


@app.get("/api/skills/{agent_id}/installed")
async def get_installed_skills(agent_id: str):
    if agent_id not in AGENTS:
        return JSONResponse(status_code=404, content={"error": "Agent not found"})
    manifest = load_skills_manifest()
    return {"agent_id": agent_id, "skills": manifest.get(agent_id, [])}


class InstallBuiltinBody(BaseModel):
    skill_name: str


@app.post("/api/skills/{agent_id}/install-builtin")
async def install_builtin_skill(agent_id: str, body: InstallBuiltinBody):
    if agent_id not in AGENTS:
        return JSONResponse(status_code=404, content={"error": "Agent not found"})
    skill = next((s for s in TINYCLAW_BUILTIN_SKILLS if s["name"] == body.skill_name), None)
    if not skill:
        return JSONResponse(status_code=404, content={"error": f"Skill '{body.skill_name}' not found"})
    skill_md_url = f"https://raw.githubusercontent.com/{skill['repo']}/main/{skill['path']}/SKILL.md"
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(skill_md_url)
            r.raise_for_status()
            skill_content = r.text
    except Exception as e:
        return JSONResponse(status_code=502, content={"error": f"Failed to fetch SKILL.md: {e}"})
    await _append_skill_to_agent(agent_id, body.skill_name, skill_content)
    manifest = load_skills_manifest()
    if body.skill_name not in manifest.get(agent_id, []):
        manifest.setdefault(agent_id, []).append(body.skill_name)
        save_skills_manifest(manifest)
    return {"success": True, "agent_id": agent_id, "skill_name": body.skill_name}


class InstallGithubBody(BaseModel):
    repo_url: str
    skill_path: Optional[str] = None


@app.post("/api/skills/{agent_id}/install-github")
async def install_github_skill(agent_id: str, body: InstallGithubBody):
    if agent_id not in AGENTS:
        return JSONResponse(status_code=404, content={"error": "Agent not found"})
    # Parse owner/repo from URL
    import re
    m = re.match(r"https?://github\.com/([^/]+/[^/]+?)(?:\.git)?(?:/.*)?$", body.repo_url)
    if not m:
        return JSONResponse(status_code=400, content={"error": "Invalid GitHub URL"})
    owner_repo = m.group(1)
    skill_path = (body.skill_path or "").strip("/") or ""
    if skill_path and skill_path.endswith(".md"):
        raw_url = f"https://raw.githubusercontent.com/{owner_repo}/main/{skill_path}"
    elif skill_path:
        raw_url = f"https://raw.githubusercontent.com/{owner_repo}/main/{skill_path}/SKILL.md"
    else:
        raw_url = f"https://raw.githubusercontent.com/{owner_repo}/main/SKILL.md"
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(raw_url)
            r.raise_for_status()
            skill_content = r.text
    except Exception as e:
        return JSONResponse(status_code=502, content={"error": f"Failed to fetch SKILL.md from {raw_url}: {e}"})
    skill_name = skill_path.split("/")[-1] if skill_path else owner_repo.split("/")[-1]
    await _append_skill_to_agent(agent_id, skill_name, skill_content)
    manifest = load_skills_manifest()
    if skill_name not in manifest.get(agent_id, []):
        manifest.setdefault(agent_id, []).append(skill_name)
        save_skills_manifest(manifest)
    return {"success": True, "agent_id": agent_id, "skill_name": skill_name}


# ─── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    connections.append(ws)

    # Send full initial state
    await ws.send_json({
        "type": "init",
        "agents": [
            {**a, "status": agent_statuses[a["id"]], "current_task": agent_current_task[a["id"]]}
            for a in AGENTS.values()
        ],
        "config": {
            "configured": settings["configured"],
            "model": settings["model"],
            "provider": settings["provider"],
        },
        "history": chat_history[-100:],
        "projects": projects,
    })

    try:
        while True:
            data = await ws.receive_json()
            t = data.get("type")

            if t == "chat":
                agent_id = data.get("agent_id", "ceo")
                msg = data.get("message", "").strip()
                user = data.get("user", "User")

                if not msg:
                    continue

                # General chat: route to first idle agent
                if agent_id == "general":
                    agent_id = next(
                        (aid for aid, s in agent_statuses.items() if s == "IDLE"),
                        "ceo",
                    )

                if not settings["configured"]:
                    await ws.send_json({
                        "type": "error",
                        "message": "tinyclaw not configured — add your API key in Settings.",
                    })
                    continue

                if agent_statuses.get(agent_id) != "IDLE":
                    await ws.send_json({
                        "type": "error",
                        "message": f"{AGENTS[agent_id]['name']} is currently busy. Please wait.",
                    })
                    continue

                asyncio.create_task(handle_chat(agent_id, msg, user))

            elif t == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if ws in connections:
            connections.remove(ws)
