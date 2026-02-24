import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Agent, ChatMessage } from '../types'
import { Send, Users, ChevronDown, Trash2, ArrowDown } from 'lucide-react'

interface ChatProps {
  agents: Agent[]
  messages: ChatMessage[]
  selectedAgent: string
  onSelectAgent: (id: string) => void
  onSendMessage: (agentId: string, text: string) => void
  connected: boolean
  configured: boolean
}

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : ''

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function AgentMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
        h1: ({ children }) => <h1 className="text-base font-bold text-white mt-3 mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-white mt-2 mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-200 mt-2 mb-0.5">{children}</h3>,
        ul: ({ children }) => <ul className="my-1.5 ml-4 space-y-0.5 list-disc marker:text-slate-400">{children}</ul>,
        ol: ({ children }) => <ol className="my-1.5 ml-4 space-y-0.5 list-decimal marker:text-slate-400">{children}</ol>,
        li: ({ children }) => <li className="text-slate-100 leading-snug">{children}</li>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-')
          return isBlock ? (
            <pre className="chat-code my-2 block overflow-x-auto">
              <code>{children}</code>
            </pre>
          ) : (
            <code className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs font-mono text-green-300">{children}</code>
          )
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-slate-500 pl-3 my-2 text-slate-400 italic">{children}</blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">{children}</a>
        ),
        hr: () => <hr className="border-slate-600 my-2" />,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

function AgentPicker({
  agents,
  selected,
  onSelect,
}: {
  agents: Agent[]
  selected: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const agent = agents.find(a => a.id === selected)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 transition-colors"
      >
        <span className="text-base">{agent?.emoji || '👥'}</span>
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium truncate">{agent?.name || 'General Chat'}</div>
          {agent && (
            <div className="text-xs text-slate-500 truncate">{agent.role}</div>
          )}
        </div>
        {agent && (
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              agent.status === 'WORKING' ? 'bg-green-400 animate-ping' :
              agent.status === 'PLANNING' ? 'bg-indigo-400 animate-pulse' :
              'bg-slate-500'
            }`}
          />
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-20 overflow-hidden">
          <button
            onClick={() => { onSelect('general'); setOpen(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors border-b border-slate-700 ${
              selected === 'general' ? 'bg-slate-700 text-white' : 'text-slate-300'
            }`}
          >
            <Users className="w-4 h-4 text-slate-400" />
            <div className="text-left">
              <div className="font-medium">General Chat</div>
              <div className="text-xs text-slate-500">Routes to first available agent</div>
            </div>
          </button>
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => { onSelect(a.id); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors ${
                selected === a.id ? 'bg-slate-700/70 text-white' : 'text-slate-300'
              }`}
            >
              <span className="text-xl">{a.emoji}</span>
              <div className="flex-1 text-left">
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-slate-500">{a.role}</div>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  a.status === 'WORKING'  ? 'bg-green-400 animate-ping' :
                  a.status === 'PLANNING' ? 'bg-indigo-400 animate-pulse' :
                  'bg-slate-600'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SystemMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex items-center gap-2 my-2 px-2">
      <div className="flex-1 h-px bg-slate-700/60" />
      <span className="text-xs text-slate-500 italic whitespace-nowrap">— {msg.text} —</span>
      <div className="flex-1 h-px bg-slate-700/60" />
    </div>
  )
}

function MessageBubble({ msg, agents, compact }: { msg: ChatMessage; agents: Agent[]; compact?: boolean }) {
  const isUser = msg.type === 'user'
  const agent = agents.find(a => a.id === msg.agent_id)

  return (
    <div className={`flex gap-2 ${compact ? 'mb-1' : 'mb-3'} ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar — hidden in compact mode (consecutive from same sender) */}
      <div className={`flex-shrink-0 w-7 h-7 ${compact ? 'opacity-0' : ''}`}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
          style={{ backgroundColor: isUser ? '#4338ca' : `${agent?.color || '#475569'}25` }}
        >
          {isUser ? '👤' : (agent?.emoji || '🤖')}
        </div>
      </div>

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {!compact && (
          <div className={`text-xs text-slate-500 mb-0.5 flex items-center gap-1 ${isUser ? 'flex-row-reverse' : ''}`}>
            <span>{isUser ? 'You' : agent?.name}</span>
            <span>·</span>
            <span>{formatTime(msg.timestamp)}</span>
          </div>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-indigo-600 text-white rounded-br-sm'
              : 'bg-slate-700/80 text-slate-100 rounded-bl-sm'
          }`}
        >
          {isUser ? msg.text : <AgentMarkdown text={msg.text} />}
        </div>
        {compact && (
          <div className="text-[10px] text-slate-600 mt-0.5 px-1">{formatTime(msg.timestamp)}</div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator({ agent }: { agent: Agent }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-sm flex-shrink-0">
        {agent.emoji}
      </div>
      <div className="bg-slate-700/80 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
        <div className="typing-dot w-1.5 h-1.5 bg-slate-400 rounded-full" />
        <div className="typing-dot w-1.5 h-1.5 bg-slate-400 rounded-full" />
        <div className="typing-dot w-1.5 h-1.5 bg-slate-400 rounded-full" />
      </div>
      <span className="text-xs text-slate-600">{agent.status.toLowerCase()}</span>
    </div>
  )
}

export default function Chat({
  agents,
  messages,
  selectedAgent,
  onSelectAgent,
  onSendMessage,
  connected,
  configured,
}: ChatProps) {
  const [input, setInput] = useState('')
  const [targetAgent, setTargetAgent] = useState(selectedAgent || 'ceo')
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedAgent) setTargetAgent(selectedAgent)
  }, [selectedAgent])

  // Auto-scroll only when already pinned to bottom
  useEffect(() => {
    if (atBottom) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, atBottom])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60)
  }

  function scrollToBottom() {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
    setAtBottom(true)
  }

  const visibleMessages = targetAgent === 'general'
    ? messages
    : messages.filter(m => m.type === 'system' || m.agent_id === targetAgent)

  const activeAgent = agents.find(a => a.id === targetAgent)
  const isBusy = activeAgent && activeAgent.status !== 'IDLE'

  function send() {
    const text = input.trim()
    if (!text || !connected || !configured) return

    const agentId = targetAgent === 'general'
      ? (agents.find(a => a.status === 'IDLE')?.id || 'ceo')
      : targetAgent

    onSendMessage(agentId, text)
    onSelectAgent(agentId)
    setInput('')
    // Pin to bottom when user sends a message
    setAtBottom(true)
  }

  async function clearHistory() {
    await fetch(`${API_BASE}/api/chat/clear`, { method: 'POST' })
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">

      {/* Agent picker header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-700 flex-shrink-0">
        <AgentPicker
          agents={agents}
          selected={targetAgent}
          onSelect={(id) => { setTargetAgent(id); onSelectAgent(id) }}
        />
      </div>

      {/* Messages — scrollable, fixed height */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-3 py-3"
        >
          {!configured && (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">🔑</div>
              <div className="text-sm text-slate-400 font-medium">Not configured</div>
              <div className="text-xs text-slate-600 mt-1">Click "Configure AI" above to add your API key</div>
            </div>
          )}

          {configured && visibleMessages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">{activeAgent?.emoji || '💬'}</div>
              <div className="text-sm text-slate-400 font-medium">
                {targetAgent === 'general' ? 'General Chat' : activeAgent?.name}
              </div>
              <div className="text-xs text-slate-600 mt-1">Start a conversation…</div>
            </div>
          )}

          {visibleMessages.map((msg, i) => {
            if (msg.type === 'system') return <SystemMessage key={msg.id} msg={msg} />
            const prev = visibleMessages[i - 1]
            const compact = !!prev && prev.type === msg.type && prev.agent_id === msg.agent_id
            return <MessageBubble key={msg.id} msg={msg} agents={agents} compact={compact} />
          })}

          {activeAgent && ['PLANNING', 'WORKING'].includes(activeAgent.status) && (
            <TypingIndicator agent={activeAgent} />
          )}

          <div ref={endRef} />
        </div>

        {/* Scroll-to-bottom button */}
        {!atBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg transition-all animate-fade-in z-10"
          >
            <ArrowDown className="w-3 h-3" />
            Latest
          </button>
        )}
      </div>

      {/* Busy bar */}
      {isBusy && activeAgent && (
        <div className="px-3 py-1.5 bg-slate-800/60 text-xs text-slate-500 flex items-center gap-1.5 border-t border-slate-700/50 flex-shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            activeAgent.status === 'WORKING' ? 'bg-green-400 animate-ping' : 'bg-indigo-400 animate-pulse'
          }`} />
          {activeAgent.name} is {activeAgent.status.toLowerCase()}
          {activeAgent.current_task && ` — ${activeAgent.current_task}`}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-slate-700 bg-slate-800/50 flex-shrink-0">
        {!connected ? (
          <div className="text-center text-xs text-red-400 py-2">⚠️ Disconnected — reconnecting…</div>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder={
                !configured ? 'Configure API key first…'
                : isBusy ? `${activeAgent?.name} is busy…`
                : 'Message… (⏎ send, ⇧⏎ newline)'
              }
              disabled={!configured || !!isBusy}
              rows={2}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={send}
                disabled={!input.trim() || !connected || !configured || !!isBusy}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl p-2 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
              {messages.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-slate-600 hover:text-red-400 p-2 rounded-xl transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
