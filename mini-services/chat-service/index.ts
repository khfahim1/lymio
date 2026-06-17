import { createServer } from 'http'
import { Server } from 'socket.io'

// ---------------------------------------------------------------------------
// Lymio chat mini-service
// ---------------------------------------------------------------------------
// Socket.io server on port 3003 (path: "/", CORS: "*").
// Implements:
//   - Username join + presence
//   - Direct + group messaging via socket rooms
//   - Room management (join-room / leave-room)
//   - WebRTC signaling for P2P file transfer
//     (webrtc-offer / webrtc-answer / webrtc-ice-candidate)
//   - File offer handshake (file-offer / file-offer-response)
//   - Typing indicator
//   - Online users list (Map<socketId, {id, username, avatar}>)
// ---------------------------------------------------------------------------

interface ChatUser {
  id: string // socket id
  username: string
  avatar?: string
}

type MessageType = 'text' | 'file-meta' | 'system'

interface ChatMessage {
  roomId: string
  sender: string
  content: string
  type: MessageType
  timestamp: string
}

interface SignalPayload {
  to: string
  from: string
  data: unknown
}

interface FileOfferPayload {
  to: string
  from: string
  fileName: string
  fileSize: number
  fileType: string
  roomId: string
}

interface FileOfferResponsePayload {
  to: string
  from: string
  accepted: boolean
}

interface TypingPayload {
  roomId: string
  username: string
  isTyping: boolean
}

// ---------------------------------------------------------------------------
// Server bootstrap — keep path: "/" + CORS "*" in sync with Caddy / example.
// ---------------------------------------------------------------------------
const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the
  // correct port.
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const PORT = 3003

// Online users registry: socketId -> user metadata
const users = new Map<string, ChatUser>()

const nowISO = () => new Date().toISOString()
const genId = () => Math.random().toString(36).slice(2, 12)

const broadcastUsersList = () => {
  const list = Array.from(users.values())
  io.emit('users-list', { users: list })
}

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`)

  // -------------------------------------------------------------------------
  // Username join
  // -------------------------------------------------------------------------
  socket.on('join', (data: { username: string; avatar?: string }) => {
    const { username, avatar } = data ?? {}
    if (!username || typeof username !== 'string') {
      socket.emit('error-message', { message: 'join requires a username' })
      return
    }

    const user: ChatUser = {
      id: socket.id,
      username: username.trim().slice(0, 64),
      avatar: typeof avatar === 'string' ? avatar : undefined,
    }
    users.set(socket.id, user)

    // Notify everyone that a user joined
    io.emit('user-joined', {
      user,
      message: {
        id: genId(),
        roomId: 'lobby',
        sender: 'System',
        content: `${user.username} joined the chat`,
        type: 'system',
        timestamp: nowISO(),
      },
    })

    // Send the joiner the current users list
    socket.emit('users-list', { users: Array.from(users.values()) })

    console.log(`[join] ${user.username} (${socket.id}) — online: ${users.size}`)
  })

  // -------------------------------------------------------------------------
  // Direct + group messaging via socket rooms
  // -------------------------------------------------------------------------
  socket.on('message', (msg: Partial<ChatMessage>) => {
    const user = users.get(socket.id)
    if (!user) {
      socket.emit('error-message', { message: 'You must join before sending messages' })
      return
    }

    const roomId = typeof msg.roomId === 'string' ? msg.roomId : 'lobby'
    const content = typeof msg.content === 'string' ? msg.content : ''
    const type: MessageType =
      msg.type === 'file-meta' || msg.type === 'system' ? msg.type : 'text'

    const outgoing: ChatMessage & { id: string } = {
      id: typeof (msg as any).id === 'string' ? (msg as any).id : genId(),
      roomId,
      sender: user.username,
      content,
      type,
      timestamp: nowISO(),
    }

    io.to(roomId).emit('message', outgoing)
  })

  // -------------------------------------------------------------------------
  // Room management
  // -------------------------------------------------------------------------
  socket.on('join-room', (data: { roomId: string }) => {
    const roomId = data?.roomId
    if (!roomId || typeof roomId !== 'string') return

    socket.join(roomId)
    console.log(`[room-join] ${socket.id} -> ${roomId}`)

    // Let the room know (system message + room-joined ack to the joiner)
    io.to(roomId).emit('message', {
      id: genId(),
      roomId,
      sender: 'System',
      content: `${users.get(socket.id)?.username ?? 'A user'} joined ${roomId}`,
      type: 'system',
      timestamp: nowISO(),
    })
    socket.emit('room-joined', { roomId })
  })

  socket.on('leave-room', (data: { roomId: string }) => {
    const roomId = data?.roomId
    if (!roomId || typeof roomId !== 'string') return

    socket.leave(roomId)
    console.log(`[room-leave] ${socket.id} <- ${roomId}`)
    io.to(roomId).emit('message', {
      id: genId(),
      roomId,
      sender: 'System',
      content: `${users.get(socket.id)?.username ?? 'A user'} left ${roomId}`,
      type: 'system',
      timestamp: nowISO(),
    })
    socket.emit('room-left', { roomId })
  })

  // -------------------------------------------------------------------------
  // WebRTC signaling — forward verbatim to the target socket id.
  // -------------------------------------------------------------------------
  socket.on('webrtc-offer', (payload: SignalPayload) => {
    if (!payload || !payload.to) return
    console.log(`[webrtc-offer] ${socket.id} -> ${payload.to}`)
    io.to(payload.to).emit('webrtc-offer', { ...payload, from: socket.id })
  })

  socket.on('webrtc-answer', (payload: SignalPayload) => {
    if (!payload || !payload.to) return
    console.log(`[webrtc-answer] ${socket.id} -> ${payload.to}`)
    io.to(payload.to).emit('webrtc-answer', { ...payload, from: socket.id })
  })

  socket.on('webrtc-ice-candidate', (payload: SignalPayload) => {
    if (!payload || !payload.to) return
    io.to(payload.to).emit('webrtc-ice-candidate', { ...payload, from: socket.id })
  })

  // -------------------------------------------------------------------------
  // File offer handshake — recipient gets a prompt before P2P transfer starts.
  // -------------------------------------------------------------------------
  socket.on('file-offer', (payload: FileOfferPayload) => {
    if (!payload || !payload.to) return
    const user = users.get(socket.id)
    if (!user) {
      socket.emit('error-message', { message: 'You must join before sending files' })
      return
    }
    console.log(
      `[file-offer] ${user.username} (${socket.id}) -> ${payload.to} (${payload.fileName}, ${payload.fileSize}b)`,
    )
    io.to(payload.to).emit('file-offer', {
      to: payload.to,
      from: socket.id,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileType: payload.fileType,
      roomId: payload.roomId,
    })
  })

  socket.on('file-offer-response', (payload: FileOfferResponsePayload) => {
    if (!payload || !payload.to) return
    console.log(
      `[file-offer-response] ${socket.id} -> ${payload.to} accepted=${payload.accepted}`,
    )
    io.to(payload.to).emit('file-offer-response', {
      to: payload.to,
      from: socket.id,
      accepted: !!payload.accepted,
    })
  })

  // -------------------------------------------------------------------------
  // Typing indicator — broadcast to the room.
  // -------------------------------------------------------------------------
  socket.on('typing', (payload: TypingPayload) => {
    if (!payload || !payload.roomId) return
    socket.to(payload.roomId).emit('typing', {
      roomId: payload.roomId,
      username: payload.username,
      isTyping: !!payload.isTyping,
    })
  })

  // -------------------------------------------------------------------------
  // Presence — disconnect cleanup
  // -------------------------------------------------------------------------
  socket.on('disconnect', (reason) => {
    const user = users.get(socket.id)
    if (user) {
      users.delete(socket.id)
      io.emit('user-left', {
        user,
        message: {
          id: genId(),
          roomId: 'lobby',
          sender: 'System',
          content: `${user.username} left the chat`,
          type: 'system',
          timestamp: nowISO(),
        },
      })
      broadcastUsersList()
      console.log(
        `[disconnect] ${user.username} (${socket.id}) reason=${reason} — online: ${users.size}`,
      )
    } else {
      console.log(`[disconnect] ${socket.id} reason=${reason}`)
    }
  })

  socket.on('error', (err) => {
    console.error(`[error] socket ${socket.id}:`, err)
  })
})

// ---------------------------------------------------------------------------
// Boot + graceful shutdown
// ---------------------------------------------------------------------------
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  io.close(() => {
    httpServer.close(() => {
      console.log('WebSocket server closed')
      process.exit(0)
    })
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  io.close(() => {
    httpServer.close(() => {
      console.log('WebSocket server closed')
      process.exit(0)
    })
  })
})
