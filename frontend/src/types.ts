export type AgentStatus = 'IDLE' | 'PLANNING' | 'WORKING'

export interface Agent {
  id: string
  name: string
  role: string
  emoji: string
  color: string
  status: AgentStatus
  current_task: string
  desk_position: { x: number; y: number }
  skills: string[]
}

export interface ChatMessage {
  id: string
  type: 'user' | 'agent'
  agent_id: string
  user: string
  text: string
  timestamp: string
}

export interface Config {
  model: string
  provider: string
  configured: boolean
  api_key_preview?: string
}

export interface Notification {
  id: string
  title: string
  body: string
  kind: 'info' | 'success' | 'warning' | 'error'
  agent_id?: string
  timestamp: string
  read: boolean
}

export interface Project {
  id: string
  title: string
  description: string
  agent_ids: string[]
  priority: 'low' | 'medium' | 'high'
  status: 'active' | 'done'
  created_at: string
}
