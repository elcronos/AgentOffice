import { useState, useEffect, useRef } from 'react'
import {
  Settings as SettingsIcon,
  Wifi, WifiOff,
  MessageSquare, FolderKanban, Package,
  TriangleAlert, Bell, X, CheckCheck,
} from 'lucide-react'
import { useWebSocket } from './useWebSocket'
import { Notification } from './types'
import OfficeGame from './components/OfficeGame'
import Chat from './components/Chat'
import Settings from './components/Settings'
import Skills from './components/Skills'
import Projects from './components/Projects'

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : ''

type SideTab = 'chat' | 'projects' | 'skills'

const SIDE_TABS: { id: SideTab; icon: React.ReactNode; label: string }[] = [
  { id: 'chat', icon: <MessageSquare className="w-4 h-4" />, label: 'Chat' },
  { id: 'projects', icon: <FolderKanban className="w-4 h-4" />, label: 'Projects' },
  { id: 'skills', icon: <Package className="w-4 h-4" />, label: 'Skills' },
]

const KIND_STYLES: Record<Notification['kind'], { dot: string; border: string; icon: string }> = {
  info:    { dot: 'bg-indigo-400', border: 'border-indigo-700/40', icon: '💬' },
  success: { dot: 'bg-green-400',  border: 'border-green-700/40',  icon: '✅' },
  warning: { dot: 'bg-amber-400',  border: 'border-amber-700/40',  icon: '⚠️' },
  error:   { dot: 'bg-red-400',    border: 'border-red-700/40',    icon: '❌' },
}

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ n, onDismiss }: { n: Notification; onDismiss: () => void }) {
  const s = KIND_STYLES[n.kind]
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      className={`flex items-start gap-3 bg-slate-900 border ${s.border} rounded-lg px-3 py-2.5 shadow-xl max-w-xs w-full animate-slide-in`}
    >
      <span className="text-sm mt-0.5 flex-shrink-0">{s.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-200 leading-snug">{n.title}</div>
        {n.body && <div className="text-xs text-slate-500 mt-0.5 truncate">{n.body}</div>}
      </div>
      <button onClick={onDismiss} className="text-slate-600 hover:text-slate-400 flex-shrink-0 mt-0.5">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Notification panel ───────────────────────────────────────────────────────
function NotificationPanel({
  notifications,
  onMarkRead,
  onClear,
  onClose,
}: {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onClear: () => void
  onClose: () => void
}) {
  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-300">Notifications</span>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
            >
              <CheckCheck className="w-3 h-3" />
              Clear all
            </button>
          )}
          <button onClick={onClose} className="text-slate-600 hover:text-slate-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-600">No notifications</div>
        ) : (
          notifications.map(n => {
            const s = KIND_STYLES[n.kind]
            return (
              <button
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-800 border-b border-slate-800 last:border-0 transition-colors ${
                  n.read ? 'opacity-50' : ''
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-slate-600' : s.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 leading-snug">{n.title}</div>
                  {n.body && (
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>
                  )}
                  <div className="text-xs text-slate-600 mt-1">{relativeTime(n.timestamp)}</div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const {
    connected, agents, messages, config, projects,
    notifications, error, sendChat, setConfig, markRead, clearNotifications,
  } = useWebSocket()

  const [selectedAgent, setSelectedAgent] = useState<string>('ceo')
  const [sideTab, setSideTab] = useState<SideTab>('chat')
  const [showSettings, setShowSettings] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [toasts, setToasts] = useState<Notification[]>([])
  const bellRef = useRef<HTMLDivElement>(null)
  const prevNotifCount = useRef(0)

  const unread = notifications.filter(n => !n.read).length
  const busyCount = agents.filter(a => a.status !== 'IDLE').length

  // Pop a toast for each new incoming notification
  useEffect(() => {
    if (notifications.length > prevNotifCount.current) {
      const newest = notifications[0]
      setToasts(prev => [newest, ...prev].slice(0, 3))
    }
    prevNotifCount.current = notifications.length
  }, [notifications])

  // Close notification panel on outside click
  useEffect(() => {
    if (!showNotifications) return
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifications])

  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
    markRead(id)
  }

  async function handleSaveConfig(apiKey: string, model: string, provider: string) {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, model, provider }),
    })
    if (!res.ok) throw new Error('Failed to save config')
    setConfig(prev => ({ ...prev, configured: true, model, provider }))
    setShowSettings(false)
  }

  async function handleCreateProject(
    title: string,
    description: string,
    agentIds: string[],
    priority: string,
  ) {
    await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, agent_ids: agentIds, priority }),
    })
    setSideTab('chat')
    setSelectedAgent('ceo')
  }

  function handleDeleteProject(id: string) {
    fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏢</span>
          <div>
            <h1 className="text-sm font-bold text-white leading-none tracking-tight">AgentOffice</h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">Powered by tinyclaw</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
          {busyCount > 0 && (
            <span className="flex items-center gap-1.5 text-green-400 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {busyCount} agent{busyCount > 1 ? 's' : ''} active
            </span>
          )}
          {!config.configured && (
            <span className="flex items-center gap-1 text-amber-400">
              <TriangleAlert className="w-3 h-3" />
              Setup required
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{connected ? 'Live' : 'Offline'}</span>
          </div>

          {/* Bell */}
          <div ref={bellRef} className="relative">
            <button
              onClick={() => setShowNotifications(v => !v)}
              className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all"
            >
              <Bell className="w-3.5 h-3.5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifications && (
              <NotificationPanel
                notifications={notifications}
                onMarkRead={(id) => { markRead(id) }}
                onClear={clearNotifications}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !config.configured
                ? 'bg-amber-600/20 border border-amber-600/50 text-amber-400 hover:bg-amber-600/30'
                : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            {!config.configured ? 'Configure AI' : 'Settings'}
          </button>
        </div>
      </header>

      {/* ── Connection banner ─────────────────────────────────────────────── */}
      {!connected && (
        <div className="bg-amber-950/50 border-b border-amber-700/30 px-5 py-1.5 text-xs text-amber-400 flex items-center gap-2">
          <span className="animate-spin inline-block">⟳</span>
          Connecting to backend — waiting for server to start…
        </div>
      )}

      {/* ── Error toast ──────────────────────────────────────────────────── */}
      {error && (
        <div className="fixed top-14 right-4 z-50 bg-red-950 border border-red-700 text-red-300 text-xs px-4 py-2.5 rounded-lg shadow-xl max-w-xs">
          ⚠️ {error}
        </div>
      )}

      {/* ── Toast stack ───────────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
        {toasts.map(t => (
          <Toast key={t.id} n={t} onDismiss={() => dismissToast(t.id)} />
        ))}
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <main
        className="flex-1 flex overflow-hidden"
        style={{ height: 'calc(100vh - 53px)' }}
      >
        {/* Left: 2D Office */}
        <div className="flex-1 p-3 min-w-0 overflow-hidden">
          <OfficeGame
            agents={agents}
            selectedAgent={selectedAgent}
            onSelectAgent={(id) => {
              setSelectedAgent(id)
              setSideTab('chat')
            }}
          />
        </div>

        {/* Right: Tabbed sidebar */}
        <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col p-3 pl-0 gap-0">
          {/* Tab bar */}
          <div className="flex bg-slate-900 border border-slate-700 rounded-t-xl overflow-hidden">
            {SIDE_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSideTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
                  sideTab === tab.id
                    ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
                    : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div className="flex-1 overflow-hidden border-x border-b border-slate-700 rounded-b-xl">
            {sideTab === 'chat' && (
              <Chat
                agents={agents}
                messages={messages}
                selectedAgent={selectedAgent}
                onSelectAgent={setSelectedAgent}
                onSendMessage={sendChat}
                connected={connected}
                configured={config.configured}
              />
            )}
            {sideTab === 'projects' && (
              <Projects
                agents={agents}
                projects={projects}
                onCreateProject={handleCreateProject}
                onDeleteProject={handleDeleteProject}
              />
            )}
            {sideTab === 'skills' && (
              <Skills agents={agents} />
            )}
          </div>
        </div>
      </main>

      {/* Settings modal */}
      {showSettings && (
        <Settings
          config={config}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveConfig}
        />
      )}
    </div>
  )
}
