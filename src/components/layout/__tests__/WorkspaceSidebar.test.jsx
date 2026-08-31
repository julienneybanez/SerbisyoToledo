import { screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import WorkspaceSidebar from '../WorkspaceSidebar';
import { messageAPI } from '../../../services/api';
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
}));

vi.mock('../../../services/socket', () => ({
  connectMessagingSocket: vi.fn(),
}));

describe('WorkspaceSidebar message badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectMessagingSocket.mockResolvedValue(socketMock);
  });

  it('does not render a zero unread badge', async () => {
    messageAPI.getUnreadCount.mockResolvedValue({
      success: true,
      data: { count: 0 },
    });

    const { container } = renderWithAppProviders(
      <WorkspaceSidebar role="tradesperson" />
    );

    await waitFor(() => {
      expect(messageAPI.getUnreadCount).toHaveBeenCalledTimes(1);
    });

    expect(container.querySelector('.workspace-nav-badge')).not.toBeInTheDocument();
  });

  it('shows the unread count beside Messages when messages are unread', async () => {
    messageAPI.getUnreadCount.mockResolvedValue({
      success: true,
      data: { count: 3 },
    });

    renderWithAppProviders(<WorkspaceSidebar role="client" />);

    expect(await screen.findByLabelText('3 unread messages')).toHaveTextContent('3');

    await waitFor(() => {
      expect(socketMock.on).toHaveBeenCalledWith('message:new', expect.any(Function));
      expect(socketMock.on).toHaveBeenCalledWith('messages:unread-changed', expect.any(Function));
    });
  });
});
