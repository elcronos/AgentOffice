import { useState, useEffect } from 'react'
import { Agent } from '../types'
import { Package, Download, RefreshCw, Github } from 'lucide-react'

interface SkillsProps {
  agents: Agent[]
}

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : ''

interface BuiltinSkill {
  name: string
  description: string
  repo: string
  path: string
}

export default function Skills({ agents }: SkillsProps) {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || 'ceo')
  const [installedSkills, setInstalledSkills] = useState<string[]>([])
  const [builtinSkills, setBuiltinSkills] = useState<BuiltinSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [githubPath, setGithubPath] = useState('')
  const [githubInstalling, setGithubInstalling] = useState(false)

  async function loadSkills() {
    setLoading(true)
    setStatus(null)
    try {
      const [installedRes, builtinRes] = await Promise.all([
        fetch(`${API_BASE}/api/skills/${selectedAgent}/installed`),
        fetch(`${API_BASE}/api/skills/builtin`),
      ])
      if (installedRes.ok) {
        const d = await installedRes.json()
        setInstalledSkills(d.skills || [])
      }
      if (builtinRes.ok) {
        const d = await builtinRes.json()
        setBuiltinSkills(d.skills || [])
      }
    } catch {
      setStatus('Could not load skills — check that the backend is running')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedAgent) loadSkills()
  }, [selectedAgent])

  async function installBuiltin(skillName: string) {
    setInstalling(skillName)
    setStatus(null)
    try {
      const res = await fetch(`${API_BASE}/api/skills/${selectedAgent}/install-builtin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_name: skillName }),
      })
      const d = await res.json()
      if (d.success) {
        setStatus(`✓ Installed '${skillName}'`)
        await loadSkills()
      } else {
        setStatus(`Failed: ${d.error || 'Unknown error'}`)
      }
    } catch {
      setStatus('Install failed — check that the backend is running')
    } finally {
      setInstalling(null)
    }
  }

  async function installFromGithub() {
    if (!githubUrl.trim()) return
    setGithubInstalling(true)
    setStatus(null)
    try {
      const res = await fetch(`${API_BASE}/api/skills/${selectedAgent}/install-github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: githubUrl.trim(),
          skill_path: githubPath.trim() || undefined,
        }),
      })
      const d = await res.json()
      if (d.success) {
        setStatus(`✓ Installed '${d.skill_name}' from GitHub`)
        setGithubUrl('')
        setGithubPath('')
        await loadSkills()
      } else {
        setStatus(`Failed: ${d.error || 'Unknown error'}`)
      }
    } catch {
      setStatus('GitHub install failed — check that the backend is running')
    } finally {
      setGithubInstalling(false)
    }
  }

  const agent = agents.find(a => a.id === selectedAgent)

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">Skills Manager</span>
        </div>
        <button
          onClick={loadSkills}
          disabled={loading}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Agent selector */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 flex-shrink-0">Agent:</span>
          <div className="flex gap-1 flex-wrap">
            {agents.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAgent(a.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedAgent === a.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {a.emoji} {a.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status message */}
        {status && (
          <div className={`text-xs px-3 py-2 rounded-lg border ${
            status.startsWith('✓')
              ? 'bg-green-900/20 border-green-700/50 text-green-400'
              : 'bg-red-900/20 border-red-700/50 text-red-400'
          }`}>
            {status}
          </div>
        )}

        {/* Installed skills */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Installed Skills — {agent?.name}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Loading…
            </div>
          ) : installedSkills.length === 0 ? (
            <div className="text-xs text-slate-600 bg-slate-800/50 rounded-lg p-3 text-center">
              No skills installed yet.<br />
              <span className="text-slate-500">Install from built-ins below.</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {installedSkills.map(skill => (
                <div
                  key={skill}
                  className="flex items-center gap-1.5 bg-indigo-900/30 border border-indigo-700/50 text-indigo-300 text-xs px-2.5 py-1 rounded-full"
                >
                  <Package className="w-3 h-3" />
                  {skill}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Built-in tinyclaw skills */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Built-in tinyclaw Skills
          </div>
          {builtinSkills.length === 0 ? (
            <div className="text-xs text-slate-600 bg-slate-800/50 rounded-lg p-3 text-center">
              {loading ? 'Loading…' : 'No built-in skills found.'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {builtinSkills.map(skill => {
                const isInstalled = installedSkills.includes(skill.name)
                const isInstallingThis = installing === skill.name
                return (
                  <div
                    key={skill.name}
                    className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2 border border-slate-700"
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="text-xs font-medium text-slate-300">{skill.name}</div>
                      <div className="text-xs text-slate-600 mt-0.5 truncate">{skill.description}</div>
                    </div>
                    {isInstalled ? (
                      <span className="text-xs text-green-400 flex items-center gap-1 flex-shrink-0">
                        ✓ Installed
                      </span>
                    ) : (
                      <button
                        onClick={() => installBuiltin(skill.name)}
                        disabled={!!isInstallingThis}
                        className="flex items-center gap-1 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-600/40 text-indigo-400 text-xs px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        {isInstallingThis ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        Install
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Install from GitHub */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Install from GitHub
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">GitHub repo URL</label>
              <input
                type="text"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Skill path (optional)</label>
              <input
                type="text"
                value={githubPath}
                onChange={e => setGithubPath(e.target.value)}
                placeholder=".agents/skills/my-skill"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={installFromGithub}
              disabled={!githubUrl.trim() || githubInstalling}
              className="w-full flex items-center justify-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-600/40 text-indigo-400 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {githubInstalling ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Github className="w-3 h-3" />
              )}
              {githubInstalling ? 'Installing…' : 'Install from GitHub'}
            </button>
          </div>
        </div>

        {/* About tinyclaw Skills */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-500">
          <div className="font-medium text-slate-400 mb-1">About tinyclaw Skills</div>
          Skills are context extensions — each skill's SKILL.md is appended to the agent's system
          prompt, teaching the agent new capabilities. Install built-ins or any GitHub repo with a SKILL.md.
        </div>
      </div>
    </div>
  )
}
