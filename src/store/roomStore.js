import { create } from 'zustand';

export const useRoomStore = create((set) => ({
  room: null,
  role: null, 
  isLoading: true,
  setRoomData: (roomData, userRole) => set({ room: roomData, role: userRole, isLoading: false }),
  clearRoom: () => set({ room: null, role: null, isLoading: true }),
}));