import { Agent } from '../types'

interface OfficeGameProps {
  agents: Agent[]
  selectedAgent: string | null
  onSelectAgent: (id: string) => void
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  IDLE:     { label: 'Idle',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  PLANNING: { label: 'Planning', color: '#818cf8', bg: 'rgba(129,140,248,0.15)' },
  WORKING:  { label: 'Working',  color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
}

const DESK_ORDER = ['ceo', 'developer', 'designer', 'manager']

const DESK_ITEMS: Record<string, string[]> = {
  ceo:       ['🖥️', '☕', '📊'],
  developer: ['💻', '🔧', '📚'],
  designer:  ['🖌️', '✏️', '📐'],
  manager:   ['📋', '📅', '🗓️'],
}

function MonitorScreen({ agent }: { agent: Agent }) {
  if (agent.status === 'WORKING') {
    return (
      <div className="absolute inset-0 overflow-hidden flex items-center">
        <div className="text-green-400 font-mono text-[8px] whitespace-nowrap marquee-text px-1">
          {'> '}{agent.current_task || 'processing request...'}{' ◼'}
        </div>
      </div>
    )
  }
  if (agent.status === 'PLANNING') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-indigo-400 font-mono text-[9px] text-center animate-pulse">
          🤔 thinking...
        </div>
      </div>
    )
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-slate-600 font-mono text-[9px]">[idle]</div>
    </div>
  )
}

function AgentDesk({
  agent,
  isSelected,
  onClick,
}: {
  agent: Agent
  isSelected: boolean
  onClick: () => void
}) {
  const meta = STATUS_META[agent.status] || STATUS_META.IDLE
  const avatarClass = {
    IDLE: 'avatar-idle',
    PLANNING: 'avatar-planning',
    WORKING: 'avatar-working',
  }[agent.status] || 'avatar-idle'

  const glowClass = {
    IDLE: '',
    PLANNING: 'desk-glow-planning',
    WORKING: 'desk-glow-working',
  }[agent.status] || ''

  const items = DESK_ITEMS[agent.id] || ['🖥️', '📝', '☕']

  return (
    <div
      className={`relative flex flex-col items-center cursor-pointer select-none
        transition-transform duration-200 ${isSelected ? 'scale-110' : 'hover:scale-105'}`}
      onClick={onClick}
    >
      {/* Thinking / Working bubble */}
      <div className="h-7 flex items-end justify-center w-full mb-0.5">
        {agent.status === 'PLANNING' && (
          <div className="bg-slate-800 border border-indigo-700/60 rounded-full px-2 py-0.5 flex items-center gap-0.5 shadow-md">
            <div className="typing-dot w-1.5 h-1.5 bg-indigo-400 rounded-full" />
            <div className="typing-dot w-1.5 h-1.5 bg-indigo-400 rounded-full" />
            <div className="typing-dot w-1.5 h-1.5 bg-indigo-400 rounded-full" />
          </div>
        )}
        {agent.status === 'WORKING' && (
          <div className="bg-green-950/80 border border-green-700/50 rounded-full px-2 py-0.5 text-[10px] text-green-400 font-medium shadow-md">
            ⚡ Working
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className={`text-3xl mb-1 ${avatarClass}`}>{agent.emoji}</div>

      {/* Desk surface */}
      <div
        className={`
          bg-slate-800/90 border-2 rounded-xl p-2.5 w-28 transition-all duration-300 relative
          ${glowClass}
          ${isSelected ? 'border-indigo-400' : 'border-slate-700 hover:border-slate-500'}
        `}
        style={isSelected ? { borderColor: agent.color } : {}}
      >
        {/* Monitor */}
        <div className="bg-slate-950 rounded-lg border border-slate-700 h-12 mb-2 relative overflow-hidden">
          {/* Monitor bezel */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800/50 flex items-center justify-center gap-0.5">
            <div className="w-0.5 h-0.5 rounded-full bg-red-500/50" />
            <div className="w-0.5 h-0.5 rounded-full bg-yellow-500/50" />
            <div className="w-0.5 h-0.5 rounded-full bg-green-500/50" />
          </div>
          <div className="absolute top-2 inset-x-0 bottom-0">
            <MonitorScreen agent={agent} />
          </div>
        </div>

        {/* Desk items */}
        <div className="flex justify-center gap-1">
          {items.map((item, i) => (
            <span key={i} className="text-sm opacity-70">{item}</span>
          ))}
        </div>

        {/* Desk stand */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-700 rounded-b" />
      </div>

      {/* Name label */}
      <div className="mt-3 text-center">
        <div className="text-xs font-semibold text-slate-200">{agent.name}</div>
        <div className="text-xs text-slate-600">{agent.role}</div>
      </div>

      {/* Status pill */}
      <div
        className="mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
        style={{
          color: meta.color,
          backgroundColor: meta.bg,
          borderColor: `${meta.color}30`,
        }}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full inline-block ${
            agent.status === 'WORKING' ? 'animate-ping' :
            agent.status === 'PLANNING' ? 'animate-pulse' : ''
          }`}
          style={{ backgroundColor: meta.color }}
        />
        {meta.label}
      </div>

      {/* Selected ring */}
      {isSelected && (
        <div
          className="absolute -inset-2 rounded-2xl border-2 pointer-events-none animate-pulse opacity-60"
          style={{ borderColor: agent.color }}
        />
      )}
    </div>
  )
}

export default function OfficeGame({ agents, selectedAgent, onSelectAgent }: OfficeGameProps) {
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]))
  const activeCount = agents.filter(a => a.status !== 'IDLE').length

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
      {/* Office header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span>🏢</span>
          <span className="text-sm font-semibold text-slate-200">AgentOffice HQ</span>
          <span className="text-xs text-slate-600">— Floor 1</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {(['IDLE', 'PLANNING', 'WORKING'] as const).map(s => {
            const meta = STATUS_META[s]
            const count = agents.filter(a => a.status === s).length
            if (count === 0) return null
            return (
              <span key={s} className="flex items-center gap-1" style={{ color: meta.color }}>
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block ${
                    s === 'WORKING' ? 'animate-ping' : s === 'PLANNING' ? 'animate-pulse' : ''
                  }`}
                  style={{ backgroundColor: meta.color }}
                />
                {count} {meta.label.toLowerCase()}
              </span>
            )
          })}
        </div>
      </div>

      {/* Office floor */}
      <div className="flex-1 floor-tile relative overflow-hidden">
        {/* Decorations */}
        <div className="absolute top-3 left-3 text-2xl opacity-40 select-none">🌿</div>
        <div className="absolute top-3 right-3 text-2xl opacity-40 select-none">🌱</div>
        <div className="absolute bottom-3 left-5 text-lg opacity-25 select-none">🖼️</div>
        <div className="absolute bottom-3 right-5 text-lg opacity-25 select-none">📌</div>

        {/* Whiteboard on top wall */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-2">
          <div className="bg-slate-100/5 border border-slate-700/60 rounded px-4 py-1 text-xs text-slate-600 font-mono">
            {activeCount > 0
              ? `🟢 ${activeCount} agent${activeCount > 1 ? 's' : ''} active`
              : '📋 All agents idle — assign a task!'}
          </div>
        </div>

        {/* Center meeting table */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-14 bg-slate-800/40 border border-slate-700/40 rounded-xl flex items-center justify-center">
            <div className="text-2xl opacity-30">🤝</div>
          </div>
        </div>

        {/* Agent 2×2 grid */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="grid grid-cols-2 gap-20">
            {DESK_ORDER.map(id => {
              const agent = agentMap[id]
              if (!agent) return null
              return (
                <AgentDesk
                  key={id}
                  agent={agent}
                  isSelected={selectedAgent === id}
                  onClick={() => onSelectAgent(id)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="text-center py-1 text-xs text-slate-700 bg-slate-800/40 flex-shrink-0">
        Click an agent to chat · Use Projects tab to assign tasks
      </div>
    </div>
  )
}
