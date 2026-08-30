import { io } from 'socket.io-client';
import { API_BASE_URL, authAPI } from './api';

export const getSocketOrigin = () => {
  const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (envSocketUrl && typeof envSocketUrl === 'string' && envSocketUrl.trim()) {
    try {
      const url = new URL(envSocketUrl.trim());
      return url.origin;
    } catch {
      return envSocketUrl.trim();
    }
  }

  try {
    if (typeof API_BASE_URL === 'string' && API_BASE_URL.startsWith('http')) {
      const url = new URL(API_BASE_URL);
      return url.origin;
    }
  } catch {
    // Fall back to current window location origin
  }

  return typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:5000';
};

let socket = null;

export const getMessagingSocket = () => {
  if (!socket) {
    socket = io(getSocketOrigin(), {
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
    socket = null;
  }
};
