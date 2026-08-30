import { screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Messages from '../Messages';
import { messageAPI } from '../../services/api';
import { connectMessagingSocket } from '../../services/socket';
import { renderWithAppProviders } from '../../test/testUtils';

const socketMock = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

vi.mock('../../services/api', () => ({
  getUser: () => ({ id: 10, fullName: 'Test Client', userType: 'client' }),
  messageAPI: {
    listConversations: vi.fn(),
    openRequestConversation: vi.fn(),
    getMessages: vi.fn(),
    markRead: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

vi.mock('../../services/socket', () => ({
  connectMessagingSocket: vi.fn(),
}));

describe('Messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageAPI.listConversations.mockResolvedValue({
      success: true,
      data: { conversations: [] },
    });
    connectMessagingSocket.mockResolvedValue(socketMock);
  });

  it('awaits the async socket connection and keeps the zero-conversation page usable', async () => {
    renderWithAppProviders(<Messages />);

    expect(await screen.findByText('No conversations yet')).toBeInTheDocument();

    await waitFor(() => {
      expect(connectMessagingSocket).toHaveBeenCalledTimes(1);
      expect(socketMock.on).toHaveBeenCalledWith('message:new', expect.any(Function));
      expect(socketMock.on).toHaveBeenCalledWith('messages:unread-changed', expect.any(Function));
    });
  });
  it('uses participant photos and does not render the redundant page title', async () => {
    messageAPI.listConversations.mockResolvedValue({
      success: true,
      data: {
        conversations: [{
          id: 5,
          serviceRequestId: 55,
          requestStatus: 'accepted',
          serviceLabel: 'Plumbing Repair',
          otherUser: {
            id: 21,
            name: 'Provider One',
            profilePhoto: 'https://example.test/provider.jpg',
          },
          unreadCount: 0,
          writable: true,
        }],
      },
    });
    messageAPI.getMessages.mockResolvedValue({
      success: true,
      data: {
        conversation: {
          id: 5,
          requestStatus: 'accepted',
          serviceLabel: 'Plumbing Repair',
          writable: true,
          otherUser: {
            id: 21,
            name: 'Provider One',
            profilePhoto: 'https://example.test/provider.jpg',
          },
        },
        messages: [],
      },
    });
    messageAPI.markRead.mockResolvedValue({ success: true });

    const { container } = renderWithAppProviders(<Messages />);

    expect((await screen.findAllByText('Provider One')).length).toBeGreaterThan(0);
    expect(container.querySelector('.messages-avatar-image')).toBeInTheDocument();
    expect(container.querySelector('.messages-page-heading')).not.toBeInTheDocument();
  });

});
