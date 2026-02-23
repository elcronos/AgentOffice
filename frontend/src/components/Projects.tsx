import { useState } from 'react'
import { Agent, Project } from '../types'
import { FolderKanban, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

interface ProjectsProps {
  agents: Agent[]
  projects: Project[]
  onCreateProject: (title: string, description: string, agentIds: string[], priority: string) => void
  onDeleteProject: (id: string) => void
}

const PRIORITY_COLORS = {
  low: 'bg-slate-700 text-slate-400 border-slate-600',
  medium: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50',
  high: 'bg-red-900/30 text-red-400 border-red-700/50',
}

function ProjectCard({
  project,
  agents,
  onDelete,
}: {
  project: Project
  agents: Agent[]
  onDelete: () => void
}) {
  const assignedAgents = agents.filter(a => project.agent_ids.includes(a.id))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLORS[project.priority]}`}>
              {project.priority}
            </span>
            <span className="text-xs text-green-400">● active</span>
          </div>
          <h3 className="text-sm font-medium text-slate-200 truncate">{project.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{project.description}</p>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1 rounded flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Assigned agents */}
      {assignedAgents.length > 0 && (
        <div className="flex gap-1 mt-2">
          {assignedAgents.map(a => (
            <div
              key={a.id}
              className="flex items-center gap-1 bg-slate-700/50 text-slate-400 text-xs px-1.5 py-0.5 rounded"
            >
              <span>{a.emoji}</span>
              <span>{a.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewProjectForm({
  agents,
  onSubmit,
  onCancel,
}: {
  agents: Agent[]
  onSubmit: (title: string, desc: string, ids: string[], priority: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([agents[0]?.id].filter(Boolean))
  const [priority, setPriority] = useState('medium')

  function toggleAgent(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function submit() {
    if (!title.trim()) return
    onSubmit(title.trim(), desc.trim(), selectedIds, priority)
  }

  return (
    <div className="bg-slate-800 border border-indigo-700/50 rounded-lg p-3 space-y-3">
      <div className="text-xs font-semibold text-indigo-400">New Project</div>

      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Project title…"
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        autoFocus
      />

      <textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="Description (agents will be briefed)…"
        rows={2}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500"
      />

      {/* Priority */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Priority:</span>
        {(['low', 'medium', 'high'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPriority(p)}
            className={`text-xs px-2 py-0.5 rounded border transition-all ${
              priority === p ? PRIORITY_COLORS[p] : 'bg-transparent text-slate-600 border-slate-700 hover:border-slate-500'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Agent assignment */}
      <div>
        <div className="text-xs text-slate-500 mb-1.5">Assign agents:</div>
        <div className="flex flex-wrap gap-1.5">
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => toggleAgent(a.id)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${
                selectedIds.includes(a.id)
                  ? 'bg-indigo-600/30 border-indigo-600/60 text-indigo-300'
                  : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              {a.emoji} {a.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs py-1.5 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs py-1.5 rounded-lg transition-colors"
        >
          Create & Brief
        </button>
      </div>
    </div>
  )
}

export default function Projects({ agents, projects, onCreateProject, onDeleteProject }: ProjectsProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">Projects</span>
          {projects.length > 0 && (
            <span className="bg-slate-700 text-slate-400 text-xs px-1.5 py-0.5 rounded-full">
              {projects.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-1 text-xs bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-600/40 text-indigo-400 px-2 py-1 rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* New project form */}
        {showForm && (
          <NewProjectForm
            agents={agents}
            onSubmit={(title, desc, ids, priority) => {
              onCreateProject(title, desc, ids, priority)
              setShowForm(false)
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Project list */}
        {projects.length === 0 && !showForm ? (
          <div className="text-center py-10">
            <FolderKanban className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <div className="text-sm text-slate-500">No projects yet</div>
            <div className="text-xs text-slate-600 mt-1">
              Create a project to assign tasks to agents
            </div>
          </div>
        ) : (
          projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              agents={agents}
              onDelete={() => onDeleteProject(project.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
