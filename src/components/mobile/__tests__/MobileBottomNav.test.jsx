import { waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MobileBottomNav from '../MobileBottomNav';
import { messageAPI, serviceRequestAPI } from '../../../services/api';
import { connectMessagingSocket } from '../../../services/socket';
import { renderWithAppProviders } from '../../../test/testUtils';

const socketMock = {
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('../../../services/api', () => ({
  messageAPI: {
    getUnreadCount: vi.fn(),
  },
  serviceRequestAPI: {
    getProviderRequests: vi.fn(),
  },
}));

vi.mock('../../../services/socket', () => ({
  connectMessagingSocket: vi.fn(),
}));

describe('MobileBottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageAPI.getUnreadCount.mockResolvedValue({
      success: true,
      data: { count: 0 },
    });
    serviceRequestAPI.getProviderRequests.mockResolvedValue({
      success: true,
      data: { requests: [] },
    });
    connectMessagingSocket.mockResolvedValue(socketMock);
  });

  it('awaits the async socket connection before registering unread-message listeners', async () => {
    renderWithAppProviders(<MobileBottomNav role="client" />);

    await waitFor(() => {
      expect(connectMessagingSocket).toHaveBeenCalledTimes(1);
      expect(socketMock.on).toHaveBeenCalledWith('messages:unread-changed', expect.any(Function));
      expect(socketMock.on).toHaveBeenCalledWith('message:new', expect.any(Function));
    });
  });
});
