import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSocketOrigin, connectMessagingSocket, disconnectMessagingSocket } from '../socket';
import { authAPI } from '../api';

describe('Frontend Socket Service Architecture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    disconnectMessagingSocket();
  });

  afterEach(() => {
    disconnectMessagingSocket();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses VITE_SOCKET_URL when configured in environment variables', () => {
    vi.stubEnv('VITE_SOCKET_URL', 'https://serbisyotoledo-backend.railway.app');
    const origin = getSocketOrigin();
    expect(origin).toBe('https://serbisyotoledo-backend.railway.app');
  });

  it('falls back to local API origin when VITE_SOCKET_URL is not set', () => {
    vi.stubEnv('VITE_SOCKET_URL', '');
    const origin = getSocketOrigin();
    // Default API_BASE_URL is http://localhost:5000/api or /api
    expect(origin).toMatch(/^http:\/\/localhost:5000|https?:\/\//);
  });

  it('connectMessagingSocket retrieves a short-lived ticket via authAPI.getSocketTicket()', async () => {
    const ticketSpy = vi.spyOn(authAPI, 'getSocketTicket').mockResolvedValue({
      success: true,
      data: { ticket: 'short-lived-socket-ticket-xyz' },
    });

    const socketInstance = await connectMessagingSocket();
    expect(ticketSpy).toHaveBeenCalledTimes(1);
    expect(socketInstance.auth).toEqual({ ticket: 'short-lived-socket-ticket-xyz' });
  });
});
