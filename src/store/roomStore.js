import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useRoomStore = create(
  persist(
    (set) => ({
      room: null,
      role: null, // 'host' or 'participant'
      isLoading: true,
      setRoomData: (roomData, userRole) => set({ room: roomData, role: userRole, isLoading: false }),
      clearRoom: () => set({ room: null, role: null, isLoading: true }),
    }),
    {
      name: 'roomix-session-storage', 
    }
  )
);