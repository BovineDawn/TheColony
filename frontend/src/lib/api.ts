import { io, Socket } from 'socket.io-client'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// ---- REST client ----
export const api = {
  get: (path: string) => fetch(`${API_BASE}${path}`).then(r => r.json()),
  post: (path: string, body: unknown) => fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),
  patch: (path: string, body?: unknown) => fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(r => r.json()),
}

// ---- Socket.IO client (singleton) ----
let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, {
      transports: ['websocket'],
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket(): Socket {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  socket?.disconnect()
}
