import { useEffect, useRef, useState, useCallback } from 'react'
import { Agent, ChatMessage, Config, Notification, Project } from './types'

const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:8000/ws'
  : `ws://${window.location.host}/ws`

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [config, setConfig] = useState<Config>({ model: '', provider: '', configured: false })
  const [projects, setProjects] = useState<Project[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [error, setError] = useState<string | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    switch (data.type) {
      case 'init':
        setAgents((data.agents as Agent[]) || [])
        setMessages((data.history as ChatMessage[]) || [])
        setConfig((data.config as Config) || { model: '', provider: '', configured: false })
        setProjects((data.projects as Project[]) || [])
        break

      case 'agent_status':
        setAgents(prev => prev.map(a =>
          a.id === data.agent_id
            ? { ...a, status: data.status as Agent['status'], current_task: data.task as string }
            : a
        ))
        break

      case 'message':
      case 'user':
      case 'agent': {
        const msg = data as unknown as ChatMessage
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        break
      }

      case 'config_updated':
        setConfig(prev => ({ ...prev, configured: data.configured as boolean }))
        break

      case 'history_cleared':
        setMessages([])
        break

      case 'project_created':
        setProjects(prev => [...prev, data.project as Project])
        break

      case 'project_deleted':
        setProjects(prev => prev.filter(p => p.id !== data.project_id))
        break

      case 'notification': {
        const n: Notification = {
          id: data.id as string,
          title: data.title as string,
          body: (data.body as string) || '',
          kind: (data.kind as Notification['kind']) || 'info',
          agent_id: data.agent_id as string | undefined,
          timestamp: data.timestamp as string,
          read: false,
        }
        setNotifications(prev => [n, ...prev].slice(0, 50))
        break
      }

      case 'error':
        setError(data.message as string)
        setTimeout(() => setError(null), 5000)
        break

      default:
        break
    }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setError(null)
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 25000)
    }

    ws.onclose = () => {
      setConnected(false)
      if (pingRef.current) clearInterval(pingRef.current)
      reconnectRef.current = setTimeout(connect, 2000)
    }

    ws.onerror = () => {
      setError('Connection error — retrying…')
    }

    ws.onmessage = (event) => {
      try {
        handleMessage(JSON.parse(event.data))
      } catch {
        // ignore parse errors
      }
    }
  }, [handleMessage])

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const sendChat = useCallback((agentId: string, text: string, user = 'You') => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'chat', agent_id: agentId, message: text, user }))
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (pingRef.current) clearInterval(pingRef.current)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected, agents, messages, config, projects, notifications, error, sendChat, setConfig, markRead, clearNotifications }
}
