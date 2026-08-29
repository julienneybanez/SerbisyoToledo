import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute, { RoleAwarePublicRoute } from '../ProtectedRoute';
import Chatbot from '../Chatbot';
import { LanguageProvider } from '../../../context/LanguageContext';
import { assistantAPI, getUser, isAuthenticated, serviceProfileAPI } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  getUser: vi.fn(),
  isAuthenticated: vi.fn(),
  assistantAPI: {
    sendMessage: vi.fn(),
  },
  serviceProfileAPI: {
    getRecommendations: vi.fn(),
  },
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('redirects unauthenticated users to login and stores redirect path', async () => {
    isAuthenticated.mockReturnValue(false);
    getUser.mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={['/dashboard?view=week']}>
        <Routes>
          <Route
            path="/dashboard"
            element={(
              <ProtectedRoute allowedRoles={['tradesperson']}>
                <div>Protected Content</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/dashboard?view=week');
  });

  it('redirects an authenticated provider away from a guest-only public route', async () => {
    isAuthenticated.mockReturnValue(true);
    getUser.mockReturnValue({ userType: 'tradesperson' });

    render(
      <MemoryRouter initialEntries={['/about']}>
        <Routes>
          <Route
            path="/about"
            element={(
              <RoleAwarePublicRoute>
                <div>Public About</div>
              </RoleAwarePublicRoute>
            )}
          />
          <Route path="/dashboard" element={<div>Provider Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Provider Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Public About')).not.toBeInTheDocument();
  });

  it('redirects authenticated users with wrong role to role home', async () => {
    isAuthenticated.mockReturnValue(true);
    getUser.mockReturnValue({ userType: 'client' });

    render(
      <MemoryRouter initialEntries={['/provider-settings']}>
        <Routes>
          <Route
            path="/provider-settings"
            element={(
              <ProtectedRoute allowedRoles={['tradesperson']}>
                <div>Provider Settings</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/client-dashboard" element={<div>Client Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Client Dashboard')).toBeInTheDocument();
  });
});

describe('Chatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  const renderChatbot = () => render(
    <LanguageProvider>
      <Chatbot isOpen onClose={() => {}} context={{ route: '/feed', role: 'client' }} />
    </LanguageProvider>,
  );

  it('uses the assistant backend intent before loading live provider recommendations', async () => {
    assistantAPI.sendMessage.mockResolvedValue({
      success: true,
      data: {
        reply: 'I can help.',
        action: {
          type: 'recommend_providers',
          query: 'plumber near Toledo under 1000',
        },
      },
    });

    serviceProfileAPI.getRecommendations.mockResolvedValue({
      success: true,
      data: {
        providers: [
          {
            id: 9,
            name: 'Mario Helper',
            rating: 4.8,
            profession: 'Plumber',
            location: 'Toledo City',
            startingPrice: 450,
            pricingUnit: 'per_hour',
            languages: ['en'],
          },
        ],
      },
    });

    renderChatbot();

    const input = screen.getByLabelText('Message SerbisyoToledo assistant');
    fireEvent.change(input, {
      target: { value: 'I need a plumber near Toledo under 1000' },
    });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(assistantAPI.sendMessage).toHaveBeenCalledWith({
        message: 'I need a plumber near Toledo under 1000',
        locale: 'en',
        context: { route: '/feed', role: 'client' },
        history: [],
      });
      expect(serviceProfileAPI.getRecommendations).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Mario Helper')).toBeInTheDocument();
    expect(screen.getByText('P450 / hour')).toBeInTheDocument();
  });

  it('automatically scrolls to the latest message after a reply', async () => {
    assistantAPI.sendMessage.mockResolvedValue({
      success: true,
      data: {
        reply: 'Here is the latest reply.',
        action: null,
      },
    });

    renderChatbot();

    const input = screen.getByLabelText('Message SerbisyoToledo assistant');
    fireEvent.change(input, { target: { value: 'How does booking work?' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Here is the latest reply.')).toBeInTheDocument();

    await waitFor(() => {
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  it('allows copying a bot response', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderChatbot();

    const copyButtons = await screen.findAllByTitle('Copy response');
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(screen.getByTitle('Copied')).toBeInTheDocument();
  });
});
