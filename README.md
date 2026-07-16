# 🎬 Roomix

**Real-time collaborative rooms for movie nights, study sessions, and everything in between.**

Roomix is a full-stack web application that lets you create virtual rooms where friends, classmates, or teammates can watch YouTube videos together, chat in real-time, doodle on a shared whiteboard, and even share screens — all synchronized and seamless.

---

## ✨ Features

### 🔐 Authentication & Rooms
- **Email/Password Auth** — Sign up and log in securely with Supabase Auth
- **Room Creation** — Create named rooms instantly from the dashboard
- **Join via Link** — Share the room URL and anyone with an account can join
- **Role-Based Access** — Room creators are the **Host** with elevated controls; everyone else joins as a **Participant**
- **Row Level Security** — PostgreSQL RLS policies ensure data isolation between rooms

### 🎥 Synchronized Video Player
- **YouTube Integration** — Paste any YouTube URL and it loads for everyone in the room
- **Host-Controlled Playback** — Play, pause, and seek are synced in real-time from the host to all participants
- **Participant Controls Locked** — Participants see the video but cannot independently control playback
- **Video Queue** — Add multiple YouTube links to a playlist queue; videos auto-play in sequence when the current one ends

### 🖥️ Screen Sharing (Host-Only)
- **Host Screen Capture** — The host can share their screen (window, tab, or entire display) via the browser's `getDisplayMedia` API
- **PeerJS WebRTC Streaming** — The captured screen is streamed to all participants in real-time using peer-to-peer WebRTC connections
- **Signaling via Supabase** — Connection coordination uses Supabase Broadcast so participants connect only when the host is ready
- **One-Click Stop** — Stop sharing via the overlay button or the browser's native "Stop sharing" control

### 💬 Real-Time Chat
- **Instant Messaging** — Messages are sent and received in real-time using Supabase Realtime (Postgres Changes)
- **Message History** — Chat history is persisted in the database and loaded when you join the room
- **Sender Attribution** — Each message shows the sender's username (derived from email)
- **Auto-Scroll** — Chat automatically scrolls to the latest message

### 🎨 Shared Whiteboard
- **Collaborative Canvas** — A real-time shared drawing board where all participants can sketch simultaneously
- **Color Picker** — Choose from 5 colors (white, red, blue, green, yellow)
- **Broadcast Sync** — Every stroke is broadcast to all connected users via Supabase Realtime
- **Clear Board** — One click to wipe the canvas for everyone

### 👥 Live Presence
- **Online Indicators** — See who's currently in the room with live avatar badges in the header
- **Join/Leave Tracking** — Supabase Presence tracks user connections in real-time
- **Role Badges** — Host users are visually distinguished from participants

### 🖼️ Adaptive UI
- **Resizable Sidebar** — Drag to resize the chat/queue panel on desktop
- **View Toggles** — Show/hide the video player and whiteboard independently or side-by-side
- **Mobile Responsive** — Optimized layout for smaller screens with stacked views
- **Dark Mode** — Ships with dark theme by default, with light mode support via `next-themes`

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **UI Library** | [React 19](https://react.dev/) |
| **Language** | JavaScript (JSX) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **Components** | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) |
| **Backend & Database** | [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime) |
| **Screen Sharing** | [PeerJS](https://peerjs.com/) (WebRTC) |
| **Notifications** | [Sonner](https://sonner.emilkowal.dev/) |
| **Theming** | [next-themes](https://github.com/pacocoursey/next-themes) |

---

## 📁 Project Structure

```
roomix/
├── src/
│   ├── app/
│   │   ├── (auth)/login/       # Login & Sign Up page
│   │   ├── dashboard/          # Room creation & room list
│   │   ├── room/[id]/          # Dynamic room page (main workspace)
│   │   ├── layout.jsx          # Root layout (providers, theme, toaster)
│   │   ├── globals.css         # Tailwind + shadcn theme tokens
│   │   └── page.jsx            # Landing redirect
│   │
│   ├── components/
│   │   ├── providers/
│   │   │   ├── AuthProvider.jsx    # Supabase Auth context + route guards
│   │   │   └── ThemeProvider.jsx   # Dark/light mode provider
│   │   ├── room/
│   │   │   ├── Chat.jsx           # Real-time chat with message history
│   │   │   ├── HeaderAvatars.jsx  # Live presence avatar badges
│   │   │   ├── ParticipantList.jsx# Online users list with roles
│   │   │   ├── Player.jsx         # YouTube player with synced controls
│   │   │   ├── ScreenShare.jsx    # Host-only WebRTC screen sharing
│   │   │   ├── VideoQueue.jsx     # Playlist queue with auto-play
│   │   │   └── Whiteboard.jsx     # Collaborative drawing canvas
│   │   └── ui/                    # shadcn/ui primitives (Button, Card, Input, etc.)
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   └── client.js         # Browser Supabase client
│   │   ├── client.js             # General client utilities
│   │   ├── server.js             # Server-side Supabase client
│   │   ├── middleware.js         # Auth middleware
│   │   └── utils.js              # cn() helper for Tailwind merging
│   │
│   └── store/
│       └── roomStore.js          # Zustand store (room data, user role)
│
├── public/                       # Static assets
├── package.json
└── next.config.mjs
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- A [Supabase](https://supabase.com/) project

### 1. Clone the repository

```bash
git clone https://github.com/anshh02/Roomix.git
cd Roomix
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### 4. Set up Supabase

You'll need the following tables in your Supabase project:

#### `rooms` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `name` | `text` | Room display name |
| `host_id` | `uuid` | References `auth.users(id)` |
| `current_video_url` | `text` | Currently playing YouTube URL |
| `created_at` | `timestamptz` | Default `now()` |

#### `room_members` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `room_id` | `uuid` | References `rooms(id)` |
| `user_id` | `uuid` | References `auth.users(id)` |
| `role` | `text` | `'host'` or `'participant'` |

#### `messages` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `room_id` | `uuid` | References `rooms(id)` |
| `user_id` | `uuid` | References `auth.users(id)` |
| `content` | `text` | Message body |
| `created_at` | `timestamptz` | Default `now()` |

#### `profiles` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, references `auth.users(id)` |
| `email` | `text` | User email |

> **Important:** Enable **Realtime** on the `messages` table in your Supabase dashboard (Database → Replication) for the chat to work.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Supabase Row Level Security

Make sure to enable RLS on all tables and create appropriate policies. Example policies:

```sql
-- Allow authenticated users to read rooms they are members of
CREATE POLICY "Members can view their rooms" ON rooms
  FOR SELECT USING (
    id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );

-- Allow authenticated users to create rooms
CREATE POLICY "Authenticated users can create rooms" ON rooms
  FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Messages: members can read messages in their rooms
CREATE POLICY "Members can read room messages" ON messages
  FOR SELECT USING (
    room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );

-- Messages: members can send messages to their rooms
CREATE POLICY "Members can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );
```

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).
