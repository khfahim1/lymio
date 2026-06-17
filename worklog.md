# Lymio Build Worklog

Project: Lymio - Minecraft community platform (news, mods, premium accounts, P2P chat)
Stack adaptation: Next.js 16 + Prisma/SQLite (in place of Firebase) + Socket.io mini-service (real-time chat) + WebRTC (P2P file transfer). Adsterra ad-wall gatekeeper for premium accounts. Modrinth API for mods with fallback.

---
Task ID: 1
Agent: Main (Z.ai Code)
Task: Set up Prisma schema for Lymio (accounts, news cache, mods cache, chat users/messages)

Work Log:
- Inspected existing scaffold (Next.js 16, shadcn/ui, Prisma SQLite, socket.io example)
- Designed schema: MinecraftAccount, NewsArticle, ModEntry, ChatUser, ChatMessage, AccountClaim
- Will push schema via prisma db push

Stage Summary:
- Schema ready for Lymio domain model

---
Task ID: 2-a
Agent: Sub-agent (general-purpose)
Task: Build the Lymio chat mini-service — Socket.io + WebRTC signaling service (independent bun project)

Work Log:
- Read /home/z/my-project/worklog.md (prior: Task 1 — Prisma schema for Lymio domain model)
- Read /home/z/my-project/examples/websocket/server.ts for path/port conventions (path: "/", CORS "*", pingTimeout 60000, pingInterval 25000, port 3003)
- Created /home/z/my-project/mini-services/chat-service/ (independent bun project)
- package.json: { name: lymio-chat-service, deps: socket.io ^4.7.5, scripts: dev -> "bun --hot index.ts", start -> "bun index.ts" }
- index.ts: Socket.io server on port 3003, path "/", CORS "*", with the following event handlers:
  - join { username, avatar? }            -> register user, broadcast user-joined, emit users-list to joiner (also re-broadcast users-list to everyone on changes)
  - message { roomId, sender, content, type } -> io.to(roomId).emit("message", msg); type validated to text | file-meta | system
  - join-room { roomId }                  -> socket.join(roomId), system message + room-joined ack
  - leave-room { roomId }                 -> socket.leave(roomId), system message + room-left ack
  - webrtc-offer    { to, from, data }    -> io.to(to).emit("webrtc-offer",    { ...payload, from: socket.id })
  - webrtc-answer   { to, from, data }    -> io.to(to).emit("webrtc-answer",   { ...payload, from: socket.id })
  - webrtc-ice-candidate { to, from, data } -> io.to(to).emit("webrtc-ice-candidate", { ...payload, from: socket.id })
  - file-offer { to, from, fileName, fileSize, fileType, roomId } -> io.to(to).emit("file-offer", ...) (sender must be joined)
  - file-offer-response { to, from, accepted } -> io.to(to).emit("file-offer-response", { ...payload, from: socket.id })
  - typing { roomId, username, isTyping } -> socket.to(roomId).emit("typing", ...)
  - disconnect                            -> broadcast user-left + updated users-list; logs reason
  - error                                 -> logged to console
- Online users registry: Map<socketId, { id, username, avatar? }>  + helper broadcastUsersList()
- Console logging on connect / join / room-join / room-leave / webrtc-offer / webrtc-answer / file-offer / file-offer-response / disconnect / error
- Graceful shutdown: SIGTERM + SIGINT close io + httpServer then process.exit(0)
- Ran `bun install` — resolved 22 packages, socket.io@4.8.3 installed, lockfile saved
- Started the service in the background with nohup (double-fork via `setsid -f` so the persistent shell's job control does not reap the process between Bash calls):
    cd /home/z/my-project/mini-services/chat-service && nohup bun run dev > service.log 2>&1 < /dev/null &
  (Wrapper: `( setsid -f bash -c 'exec bun run dev > .../service.log 2>&1 < /dev/null' & )`)
- service.log shows: "$ bun --hot index.ts" then "WebSocket server running on port 3003"
- Verified via `pgrep -af bun` -> two procs alive: `bun run dev` (PID 1852) + `bun --hot index.ts` (PID 1853)
- Verified via curl of the Engine.io polling endpoint -> returns valid Socket.io v4 handshake JSON: {"sid":..., "upgrades":["websocket"], "pingInterval":25000, "pingTimeout":60000, "maxPayload":1000000}

Stage Summary:
- Chat mini-service live on port 3003, Socket.io v4, path "/", CORS "*"
- All required socket events implemented: join, message, join-room, leave-room, webrtc-offer, webrtc-answer, webrtc-ice-candidate, file-offer, file-offer-response, typing, disconnect/presence, users-list
- Process is detached and persists across shell invocations; service.log captures all output
- Next: frontend chat client can connect to ws://<host>:3003/ (or via Caddy path-based proxy) and exercise the events above

---
Task ID: 3-7 (Main build + verification)
Agent: Main (Z.ai Code)
Task: Build API routes, main page UI (news/mods/premium+ad-gate/chat/admin), integrate Adsterra, generate branding, self-verify with Agent Browser

Work Log:
- Built backend services: news-service.ts (RSS/JSON fetch from minecraft.net + feedback.minecraft.net whitelisted sources, dedupe + seed), mods-service.ts (Modrinth API + curated fallback map for sodium/fabric-api/iris/create/lithium/jei)
- API routes: /api/news (GET cached + auto-refresh, POST force-refresh cron), /api/mods (GET trending from Modrinth), /api/mods/redirect (GET live Modrinth check + fallback), /api/accounts/claim (POST enforces adSessionCount===5 with spacing>=1.5s + >=3 distinct types, atomic claim), /api/admin/verify (two-step 67439 + Elitebook@2.3, time-windowed token), /api/admin/accounts (GET/POST/DELETE inventory)
- Built client sections: news-section (card grid, refresh), mods-section (featured + trending, search, redirect-on-click), premium-section (5-step ad-wall state machine, inline Native Banner + 728 banner, reveal dialog with copy/show), chat-section (socket.io rooms + WebRTC data channels for P2P file transfer + file-offer handshake + typing indicator), admin-section (two-step OTP + bulk add textarea + inventory table)
- Built main page.tsx: sticky header with logo + tab nav, hero (news tab), dual 160x300 sidebar ads, Native Banner core placement, sticky footer with mt-auto
- Integrated all Adsterra scripts per binding map: popunder (head), native banner (body), 728x90 + 160x300 banners, social bar (footer), smartlink CTA
- Generated branding: hero.png (Minecraft voxel landscape), logo-lymio.png (emerald L block), premium-vault.png (diamond sword vault)
- Seeded DB: 5 news articles, 6 curated mods, 4 premium accounts
- Fixed React key warning: server now emits id field on all messages (genId), client uses fallback key
- Agent Browser self-verification (via Caddy port 81 for real gateway experience):
  * News tab: 5 articles render with images/categories/time-ago ✓
  * Mods tab: live Modrinth data (Fabric API 186M downloads etc.) + featured section ✓
  * Premium tab: walked full 5-ad flow (popunder→smartlink→native→social→728), server verified adSessionCount===5, claimed steve_builder@example.com, inventory 4→3 available ✓
  * Admin tab: two-step auth (67439/Elitebook@2.3) unlocked, inventory table with masked passwords ✓
  * Chat tab: socket connected through gateway, joined as TestUser2, sent messages, real-time echo confirmed, no console errors ✓
  * Sticky footer: min-h-screen flex flex-col + mt-auto verified ✓
  * Mobile responsive: 390x844 viewport verified ✓
  * Zero page errors, zero console warnings after key fix ✓

Stage Summary:
- All 4 core Lymio features operational and browser-verified
- Stack adaptation: Prisma/SQLite (in place of Firebase) + Socket.io mini-service (port 3003) for real-time chat + WebRTC data channels for zero-cloud P2P file transfer
- Adsterra fully integrated (App ID 5851493, all 6 placements)
- Admin two-step auth working (67439 then Elitebook@2.3)
- Services running: Next.js :3000, Chat :3003, Caddy gateway :81
