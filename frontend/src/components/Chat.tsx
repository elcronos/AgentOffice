import { useEffect, useRef, useState } from 'react'
import { Agent, ChatMessage } from '../types'
import { Send, Users, ChevronDown, Trash2 } from 'lucide-react'

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

/** Very simple markdown → JSX: handles ``` code blocks and **bold** */
function FormattedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{text.slice(lastIndex, match.index)}</span>)
    }
    parts.push(
      <pre key={match.index} className="chat-code my-1 block">
        {match[1].trim()}
      </pre>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>)
  }

  return <>{parts.length ? parts : text}</>
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

function MessageBubble({ msg, agents }: { msg: ChatMessage; agents: Agent[] }) {
  const isUser = msg.type === 'user'
  const agent = agents.find(a => a.id === msg.agent_id)

  return (
    <div className={`flex gap-2 mb-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm"
        style={{
          backgroundColor: isUser ? '#4338ca' : `${agent?.color || '#475569'}25`,
        }}
      >
        {isUser ? '👤' : (agent?.emoji || '🤖')}
      </div>

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        <div className={`text-xs text-slate-600 mb-0.5 flex items-center gap-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span>{isUser ? 'You' : agent?.name}</span>
          <span>·</span>
          <span>{formatTime(msg.timestamp)}</span>
        </div>

        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-indigo-600 text-white rounded-br-sm'
              : 'bg-slate-700/80 text-slate-100 rounded-bl-sm'
          }`}
        >
          {isUser ? msg.text : <FormattedText text={msg.text} />}
        </div>
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
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedAgent) setTargetAgent(selectedAgent)
  }, [selectedAgent])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const visibleMessages = targetAgent === 'general'
    ? messages
    : messages.filter(m => m.agent_id === targetAgent || m.type === 'user' && m.agent_id === targetAgent)

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
  }

  async function clearHistory() {
    await fetch(`${API_BASE}/api/chat/clear`, { method: 'POST' })
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Agent picker header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-700">
        <AgentPicker
          agents={agents}
          selected={targetAgent}
          onSelect={(id) => { setTargetAgent(id); onSelectAgent(id) }}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
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
            <div className="text-xs text-slate-600 mt-1">
              Start a conversation…
            </div>
          </div>
        )}

        {visibleMessages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} agents={agents} />
        ))}

        {activeAgent && ['PLANNING', 'WORKING'].includes(activeAgent.status) && (
          <TypingIndicator agent={activeAgent} />
        )}

        <div ref={endRef} />
      </div>

      {/* Busy bar */}
      {isBusy && activeAgent && (
        <div className="px-3 py-1.5 bg-slate-800/60 text-xs text-slate-500 flex items-center gap-1.5 border-t border-slate-700/50">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            activeAgent.status === 'WORKING' ? 'bg-green-400 animate-ping' : 'bg-indigo-400 animate-pulse'
          }`} />
          {activeAgent.name} is {activeAgent.status.toLowerCase()}
          {activeAgent.current_task && ` — ${activeAgent.current_task}`}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-slate-700 bg-slate-800/50">
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
                : 'Message… (⏎ to send, ⇧⏎ newline)'
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
