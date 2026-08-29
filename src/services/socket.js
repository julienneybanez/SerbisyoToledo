import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

const socketOrigin = (() => {
  try {
    if (API_BASE_URL.startsWith('http')) {
      const url = new URL(API_BASE_URL);
      return url.origin;
    }
  } catch {
    // Fall back to the current browser origin.
  }
  return window.location.origin;
})();

let socket = null;

export const getMessagingSocket = () => {
  if (!socket) {
    socket = io(socketOrigin, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const connectMessagingSocket = () => {
  const instance = getMessagingSocket();
  if (!instance.connected) {
    instance.connect();
  }
  return instance;
};

export const disconnectMessagingSocket = () => {
  if (socket) {
    socket.disconnect();
  }
};
