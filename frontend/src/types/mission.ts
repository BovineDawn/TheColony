export type MissionStatus = 'pending' | 'in_progress' | 'awaiting_approval' | 'completed' | 'failed'
export type MessageType = 'chat' | 'formal_report' | 'escalation' | 'update'
export type MissionPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Message {
  id: string
  fromAgentId: string
  toAgentId: string
  content: string
  type: MessageType
  timestamp: string
  isRead: boolean
}

export interface Mission {
  id: string
  title: string
  description: string
  priority: MissionPriority
  status: MissionStatus
  createdAt: string
  assignedTo: string[]
  messages: Message[]
  result: string | null
}
