import { io } from 'socket.io-client';
import { API_BASE_URL, authAPI } from './api';

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

    socket.on('connect_error', async () => {
      try {
        const response = await authAPI.getSocketTicket();
        if (response?.success && response.data?.ticket) {
          socket.auth = { ticket: response.data.ticket };
          socket.connect();
        }
      } catch {
        // Ticket retrieval failed or user unauthenticated
      }
    });
  }
  return socket;
};

export const connectMessagingSocket = async () => {
  const instance = getMessagingSocket();
  if (!instance.connected) {
    try {
      const response = await authAPI.getSocketTicket();
      if (response?.success && response.data?.ticket) {
        instance.auth = { ticket: response.data.ticket };
      }
    } catch {
      // If ticket fetch fails, attempt connecting with cookies alone
    }
    instance.connect();
  }
  return instance;
};

export const disconnectMessagingSocket = () => {
  if (socket) {
    socket.disconnect();
  }
};
