# Product Requirements Document (PRD): Roomix

## 1. Product Overview
Roomix is a real-time collaborative web application designed to facilitate synchronized movie nights, interactive study sessions, and social engagement. By providing a virtual room-based environment, Roomix aims to bring people together online seamlessly, offering shared experiences with integrated tools such as chat, presence tracking, and a shared doodle board.

## 2. Target Audience
- **Students & Study Groups:** Needing a collaborative space for explaining concepts using a doodle board and synchronous interaction.
- **Friends & Families:** Looking to host remote movie nights with synchronized playback discussions and real-time chat.
- **Remote Teams:** Seeking a quick, informal space for collaboration and brainstorming.

## 3. Key Features & Requirements

### 3.1. Authentication and Access Control
- **Secure Authentication:** Users must be able to securely sign in using Supabase Auth.
- **Room Creation & Joining:** Users can create new unique rooms or join existing ones via a generated link or room code.
- **Row Level Security (RLS):** Database access is governed by PostgreSQL Row Level Security to ensure that room data, chats, and board states are only accessible to authorized room participants.

### 3.2. Real-Time Collaboration
- **Live Chat:** A low-latency chat interface allowing users to converse in real-time.
- **Presence Tracking:** Visual indicators showing who is currently in the room (e.g., active participants list, join/leave notifications).
- **Live Updates:** Synchronized states across all clients in a room using Supabase Realtime, ensuring seamless experiences without manual refreshing.

### 3.3. Shared Doodle Board
- **Interactive Canvas:** A shared digital whiteboard available in the room.
- **Collaborative Scribbling:** Multiple users can draw simultaneously. Useful for study visualization and visual explanations.
- **Real-Time Syncing:** Strokes and board actions are broadcast to all connected users instantly.

### 3.4. State Persistence
- **Room State Saving:** Persistent room configurations and ongoing session states stored in the database.
- **Board Saving:** Doodle board states are saved so that users can leave the room and continue their session right where they left off upon returning.

## 4. User Interface & Experience (UI/UX)
- **Responsive Design:** A clean, modern UI optimized for both desktop and mobile devices.
- **Accessibility & Aesthetics:** Built using Tailwind CSS and shadcn/ui components for a polished, consistent look and feel with smooth animations.
- **Theme Support:** Support for dark/light mode via `next-themes`.

## 5. Technology Stack
- **Frontend Framework:** Next.js (React 19)
- **Styling & UI:** Tailwind CSS, shadcn/ui, lucide-react (icons)
- **State Management:** Zustand
- **Real-time Communication:** PeerJS (for potential media streams or direct P2P data)
- **Backend & Database:** Supabase (PostgreSQL, Supabase Realtime, Supabase Auth)
- **Language:** JavaScript/JSX

## 6. Non-Functional Requirements
- **Performance:** Low latency required for drawing and chat (powered by WebSockets/Supabase Realtime).
- **Scalability:** System architecture must support concurrent users scaling with Supabase infrastructure.
- **Security:** RLS policies enforced rigorously to prevent unauthorized data access or modifications outside of assigned rooms.

## 7. Future Enhancements (Roadmap)
- Synchronized video player controls (play/pause/seek synchronization).
- Screen sharing and integrated audio/video calling.
- Expanded whiteboard tools (e.g., shapes, text boxes, image uploads).
