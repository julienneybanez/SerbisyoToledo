import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute, { RoleAwarePublicRoute } from '../ProtectedRoute';
import Chatbot from '../Chatbot';
import { getUser, isAuthenticated, serviceProfileAPI } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  getUser: vi.fn(),
  isAuthenticated: vi.fn(),
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
  });

  it('prioritizes recommendation intent and renders provider pricing with unit', async () => {
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

    render(<Chatbot isOpen onClose={() => {}} />);

    const input = screen.getByPlaceholderText('Type your message here...');
    fireEvent.change(input, {
      target: { value: 'I need a provider recommendation for a plumber near Toledo under 1000' },
    });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(serviceProfileAPI.getRecommendations).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Mario Helper')).toBeInTheDocument();
    expect(screen.getByText('P450 per hour')).toBeInTheDocument();
  });

  it('allows copy/helpful/not-helpful bot actions', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<Chatbot isOpen onClose={() => {}} />);

    const copyButtons = await screen.findAllByTitle('Copy');
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(screen.getByText('Copied')).toBeInTheDocument();

    const helpfulButtons = await screen.findAllByTitle('Helpful');
    fireEvent.click(helpfulButtons[0]);
    expect(helpfulButtons[0]).toHaveClass('active');

    const notHelpfulButtons = await screen.findAllByTitle('Not helpful');
    fireEvent.click(notHelpfulButtons[0]);
    expect(notHelpfulButtons[0]).toHaveClass('active');
  });
});
