'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MessageSquare, Send, Paperclip, Users, Wifi, FileDown, FileQuestion, X, LogIn, Hash } from 'lucide-react'
import { toast } from 'sonner'

interface ChatUser { id: string; username: string; avatar?: string }
interface Message {
  id: string
  roomId: string
  sender: string
  content: string
  type: 'text' | 'file-meta' | 'system'
  fileName?: string
  fileSize?: number
  fileType?: string
  timestamp: string | number
  pending?: boolean // P2P file awaiting sender online
}

// Global chat room + direct message support
const GENERAL_ROOM = 'group:general'

export function ChatSection() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [username, setUsername] = useState('')
  const [joined, setJoined] = useState(false)
  const [users, setUsers] = useState<ChatUser[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [currentRoom, setCurrentRoom] = useState(GENERAL_ROOM)
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({})
  // WebRTC state
  const [incomingFile, setIncomingFile] = useState<{ from: string; fileName: string; fileSize: number; fileType: string; roomId: string } | null>(null)
  const peerConns = useRef<Map<string, RTCPeerConnection>>(new Map())
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map())
  const pendingFileOffer = useRef<{ from: string; fileName: string; fileSize: number; fileType: string; roomId: string } | null>(null)
  const fileTransferMeta = useRef<Map<string, { name: string; size: number; type: string; chunks: ArrayBuffer[]; received: number }>>(new Map())
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Connect socket on mount
  useEffect(() => {
    const s = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    })
    setSocket(s)
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('users-list', (d: { users: ChatUser[] }) => setUsers(d.users))
    s.on('message', (m: Message) => {
      setMessages((prev) => [...prev, { ...m, timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date(m.timestamp as any).toISOString() }])
      // Auto-scroll
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50)
    })
    s.on('typing', (d: { roomId: string; username: string; isTyping: boolean }) => {
      setTypingUsers((prev) => ({ ...prev, [d.username]: d.isTyping }))
      if (d.isTyping) {
        setTimeout(() => setTypingUsers((prev) => ({ ...prev, [d.username]: false })), 3000)
      }
    })
    s.on('file-offer', (d: any) => {
      pendingFileOffer.current = d
      setIncomingFile(d)
    })
    // WebRTC signaling
    s.on('webrtc-offer', async (d: { from: string; data: RTCSessionDescriptionInit }) => {
      await handleOffer(d.from, d.data)
    })
    s.on('webrtc-answer', async (d: { from: string; data: RTCSessionDescriptionInit }) => {
      const pc = peerConns.current.get(d.from)
      if (pc) await pc.setRemoteDescription(d.data)
    })
    s.on('webrtc-ice-candidate', async (d: { from: string; data: RTCIceCandidateInit }) => {
      const pc = peerConns.current.get(d.from)
      if (pc) {
        try { await pc.addIceCandidate(d.data) } catch { /* ignore */ }
      }
    })
    return () => { s.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleJoin = () => {
    if (!socket || !username.trim() || !connected) return
    socket.emit('join', { username: username.trim() })
    socket.emit('join-room', { roomId: GENERAL_ROOM })
    setJoined(true)
    setCurrentRoom(GENERAL_ROOM)
  }

  const openDM = (target: ChatUser) => {
    if (!socket) return
    // Stable room id for a DM between two users
    const roomId = `dm:${[username, target.username].sort().join(':')}`
    setCurrentRoom(roomId)
    socket.emit('join-room', { roomId })
  }

  const sendMessage = () => {
    if (!socket || !input.trim()) return
    const msg: Message = {
      id: Math.random().toString(36).slice(2),
      roomId: currentRoom,
      sender: username,
      content: input.trim(),
      type: 'text',
      timestamp: new Date().toISOString(),
    }
    socket.emit('message', msg)
    setInput('')
    if (typingTimer.current) clearTimeout(typingTimer.current)
    socket.emit('typing', { roomId: currentRoom, username, isTyping: false })
  }

  const onType = (v: string) => {
    setInput(v)
    if (!socket) return
    socket.emit('typing', { roomId: currentRoom, username, isTyping: true })
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socket.emit('typing', { roomId: currentRoom, username, isTyping: false })
    }, 1500)
  }

  // ----- WebRTC P2P file transfer -----
  const createPeer = useCallback((peerId: string): RTCPeerConnection => {
    const existing = peerConns.current.get(peerId)
    if (existing) return existing
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('webrtc-ice-candidate', { to: peerId, from: socket.id, data: e.candidate.toJSON() })
      }
    }
    pc.ondatachannel = (e) => {
      const dc = e.channel
      dc.binaryType = 'arraybuffer'
      dataChannels.current.set(peerId, dc)
      wireDataChannel(dc, peerId)
    }
    peerConns.current.set(peerId, pc)
    return pc
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket])

  const wireDataChannel = (dc: RTCDataChannel, peerId: string) => {
    dc.onmessage = (e) => {
      const data = e.data
      if (typeof data === 'string') {
        // Control message
        const ctrl = JSON.parse(data)
        if (ctrl.kind === 'file-start') {
          fileTransferMeta.current.set(peerId, { name: ctrl.name, size: ctrl.size, type: ctrl.type, chunks: [], received: 0 })
          toast.info(`Receiving ${ctrl.name}...`)
        } else if (ctrl.kind === 'file-end') {
          const meta = fileTransferMeta.current.get(peerId)
          if (meta) {
            const blob = new Blob(meta.chunks, { type: meta.type })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = meta.name
            a.click()
            URL.revokeObjectURL(url)
            fileTransferMeta.current.delete(peerId)
            toast.success(`Saved ${meta.name} to your device`)
          }
        }
      } else {
        // Binary chunk
        const meta = fileTransferMeta.current.get(peerId)
        if (meta) {
          meta.chunks.push(data)
          meta.received += data.byteLength
        }
      }
    }
    dc.onopen = () => toast.success('P2P channel open — files will transfer directly')
  }

  const handleOffer = async (from: string, offer: RTCSessionDescriptionInit) => {
    const pc = createPeer(from)
    await pc.setRemoteDescription(offer)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    socket?.emit('webrtc-answer', { to: from, from: socket.id, data: answer })
  }

  const acceptIncomingFile = async () => {
    const offer = pendingFileOffer.current
    if (!offer || !socket) return
    setIncomingFile(null)
    // Initiate WebRTC as the answerer — sender will create offer after our response
    socket.emit('file-offer-response', { to: offer.from, from: socket.id, accepted: true })
    toast.success('Accepted — waiting for sender to stream the file...')
  }

  const rejectIncomingFile = () => {
    const offer = pendingFileOffer.current
    if (!offer || !socket) return
    socket.emit('file-offer-response', { to: offer.from, from: socket.id, accepted: false })
    setIncomingFile(null)
    pendingFileOffer.current = null
  }

  // Listen for file-offer-response to start the actual transfer
  useEffect(() => {
    if (!socket) return
    const handler = async (d: { from: string; accepted: boolean }) => {
      if (!d.accepted) {
        toast.error('Recipient declined the file')
        return
      }
      // We are the sender — create a data channel + offer
      const pc = createPeer(d.from)
      const dc = pc.createDataChannel('file-transfer')
      dc.binaryType = 'arraybuffer'
      dataChannels.current.set(d.from, dc)
      wireDataChannel(dc, d.from)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('webrtc-offer', { to: d.from, from: socket.id, data: offer })
      // Once channel opens, the actual file send is queued (see sendFile)
      pendingSend.current = { to: d.from }
    }
    socket.on('file-offer-response', handler)
    return () => { socket.off('file-offer-response', handler) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, createPeer])

  const pendingSend = useRef<{ to: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedFile = useRef<File | null>(null)

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !socket) return
    selectedFile.current = file

    // Decide recipient: DM -> that user; group -> first other online user (or pending)
    let targetId: string | null = null
    if (currentRoom.startsWith('dm:')) {
      const otherName = currentRoom.split(':').slice(1).find((n) => n !== username)
      targetId = users.find((u) => u.username === otherName)?.id ?? null
    } else {
      // Group: prompt the user to pick a recipient from online users
      const other = users.find((u) => u.username !== username)
      targetId = other?.id ?? null
      if (!targetId) {
        toast.error('No other online peer to transfer the file to')
        return
      }
    }
    if (!targetId) {
      toast.error('Recipient is offline — file needs sender online')
      // Post a "pending" file card in chat
      const msg: Message = {
        id: Math.random().toString(36).slice(2),
        roomId: currentRoom,
        sender: username,
        content: `Shared file (offline): ${file.name}`,
        type: 'file-meta',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        timestamp: new Date().toISOString(),
        pending: true,
      }
      socket.emit('message', msg)
      return
    }
    // Send file offer; once accepted, the effect above opens a data channel
    socket.emit('file-offer', {
      to: targetId,
      from: socket.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      roomId: currentRoom,
    })
    // Also post a file-meta message so the chat shows a card
    const msg: Message = {
      id: Math.random().toString(36).slice(2),
      roomId: currentRoom,
      sender: username,
      content: `Shared file via P2P: ${file.name}`,
      type: 'file-meta',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      timestamp: new Date().toISOString(),
    }
    socket.emit('message', msg)
    toast.info('File offer sent — waiting for recipient to accept...')
  }

  // Actually stream the file once the data channel opens
  useEffect(() => {
    if (!socket) return
    const trySend = () => {
      if (!pendingSend.current || !selectedFile.current) return
      const dc = dataChannels.current.get(pendingSend.current.to)
      if (dc && dc.readyState === 'open') {
        const file = selectedFile.current
        const meta = JSON.stringify({ kind: 'file-start', name: file.name, size: file.size, type: file.type })
        dc.send(meta)
        const reader = new FileReader()
        let offset = 0
        const CHUNK = 16 * 1024
        reader.onload = () => {
          dc.send(reader.result as ArrayBuffer)
          offset += (reader.result as ArrayBuffer).byteLength
          if (offset < file.size) {
            readSlice(offset)
          } else {
            dc.send(JSON.stringify({ kind: 'file-end' }))
            pendingSend.current = null
            selectedFile.current = null
            toast.success(`Sent ${file.name} directly to device`)
          }
        }
        const readSlice = (o: number) => {
          const slice = file.slice(o, o + CHUNK)
          reader.readAsArrayBuffer(slice)
        }
        readSlice(0)
      } else {
        setTimeout(trySend, 400)
      }
    }
    // Poll for open channel
    const t = setInterval(trySend, 500)
    return () => clearInterval(t)
  }, [socket])

  const roomMessages = messages.filter((m) => m.roomId === currentRoom)
  const otherTyping = Object.entries(typingUsers).filter(([u, v]) => v && u !== username).map(([u]) => u)

  if (!joined) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center border-border/60">
        <div className="h-14 w-14 rounded-xl lymio-grass-top grid place-items-center mx-auto mb-4 shadow-lg">
          <MessageSquare className="h-7 w-7 text-white" />
        </div>
        <h3 className="text-lg font-bold">Join the Lymio Chat</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Real-time messaging with P2P file transfer. Files go straight to recipients&apos; devices — never to the cloud.
        </p>
        <div className="flex gap-2 mb-3">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Pick a username..."
            disabled={!connected}
          />
          <Button onClick={handleJoin} disabled={!connected || !username.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            <LogIn className="h-4 w-4 mr-1" /> Enter
          </Button>
        </div>
        <Badge variant={connected ? 'secondary' : 'outline'} className={connected ? 'text-emerald-400' : 'text-muted-foreground'}>
          <Wifi className="h-3 w-3 mr-1" /> {connected ? 'Connected to chat network' : 'Connecting...'}
        </Badge>
      </Card>
    )
  }

  return (
    <Card className="border-border/60 overflow-hidden grid md:grid-cols-[220px_1fr] h-[600px]">
      {/* Sidebar: rooms + users */}
      <div className="border-r border-border/40 bg-muted/20 flex flex-col">
        <div className="p-3 border-b border-border/40">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rooms</div>
          <button
            onClick={() => { setCurrentRoom(GENERAL_ROOM); }}
            className={`w-full text-left rounded-md px-2 py-1.5 text-sm flex items-center gap-2 ${currentRoom === GENERAL_ROOM ? 'bg-emerald-500/15 text-emerald-400' : 'hover:bg-muted'}`}
          >
            <Hash className="h-3.5 w-3.5" /> general
          </button>
        </div>
        <div className="p-3 flex-1 overflow-hidden">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Online ({users.length})
          </div>
          <ScrollArea className="h-[calc(100%-1.5rem)] lymio-scroll">
            <div className="space-y-1 pr-1">
              {users.filter((u) => u.username !== username).map((u) => (
                <button
                  key={u.id}
                  onClick={() => openDM(u)}
                  className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted flex items-center gap-2"
                >
                  <div className="relative">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-emerald-700 text-white text-xs">{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                  </div>
                  <span className="text-sm truncate">{u.username}</span>
                </button>
              ))}
              {users.filter((u) => u.username !== username).length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-4">No one else online yet — invite a friend!</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-col min-w-0">
        <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between bg-background/60">
          <div className="flex items-center gap-2 min-w-0">
            {currentRoom === GENERAL_ROOM ? <Hash className="h-4 w-4 text-emerald-400" /> : <MessageSquare className="h-4 w-4 text-emerald-400" />}
            <span className="font-semibold truncate">{currentRoom === GENERAL_ROOM ? 'General chat' : currentRoom.replace('dm:', '')}</span>
          </div>
          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
            P2P files · zero cloud storage
          </Badge>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto lymio-scroll p-4 space-y-3">
          {roomMessages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm mt-10">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No messages yet. Say hi or share a file — it streams P2P.
            </div>
          )}
          {roomMessages.map((m, idx) => {
            const mine = m.sender === username
            const key = m.id || `${m.sender}-${m.timestamp}-${idx}`
            if (m.type === 'system') {
              return (
                <div key={key} className="text-center text-xs text-muted-foreground italic">
                  {m.content}
                </div>
              )
            }
            return (
              <div key={key} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className={`text-xs ${mine ? 'bg-amber-600 text-white' : 'bg-emerald-700 text-white'}`}>
                    {m.sender.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                  <span className="text-[10px] text-muted-foreground mb-0.5">{mine ? 'You' : m.sender}</span>
                  {m.type === 'file-meta' ? (
                    <div className={`rounded-lg border p-2.5 flex items-center gap-2.5 ${m.pending ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
                      {m.pending ? <FileQuestion className="h-5 w-5 text-amber-400" /> : <FileDown className="h-5 w-5 text-emerald-400" />}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{m.fileName}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatBytes(m.fileSize || 0)} · {m.pending ? 'Request from sender when online' : 'P2P transfer'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`rounded-lg px-3 py-1.5 text-sm ${mine ? 'bg-emerald-600 text-white' : 'bg-muted'}`}>
                      {m.content}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {otherTyping.length > 0 && (
            <div className="text-xs text-muted-foreground italic px-2">
              {otherTyping.join(', ')} {otherTyping.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border/40 flex items-center gap-2 bg-background/60">
          <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelect} />
          <Button size="icon" variant="outline" onClick={() => fileInputRef.current?.click()} title="Send file via P2P">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={`Message ${currentRoom === GENERAL_ROOM ? '#general' : currentRoom.replace('dm:', '')}...`}
          />
          <Button size="icon" onClick={sendMessage} disabled={!input.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Incoming file offer dialog */}
      <Dialog open={!!incomingFile} onOpenChange={(o) => { if (!o) rejectIncomingFile() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-emerald-400" /> Incoming P2P File
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">From:</span> {incomingFile?.from === socket?.id ? 'You' : 'Peer'}</div>
            <div><span className="text-muted-foreground">File:</span> {incomingFile?.fileName}</div>
            <div><span className="text-muted-foreground">Size:</span> {formatBytes(incomingFile?.fileSize || 0)}</div>
            <p className="text-xs text-muted-foreground pt-1">
              The file will be transferred directly from the sender&apos;s device to yours — never stored on any server.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={rejectIncomingFile}><X className="h-4 w-4 mr-1" /> Decline</Button>
            <Button onClick={acceptIncomingFile} className="bg-emerald-600 hover:bg-emerald-500 text-white">Accept</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`
  return `${(b / 1073741824).toFixed(1)} GB`
}
