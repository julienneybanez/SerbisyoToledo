import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getToken,
  getUser,
  setUser,
  adminAPI,
  serviceRequestAPI,
  notificationAPI,
  userProfileAPI,
  messageAPI,
} from '../api';

describe('Authentication Session Architecture', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('getToken returns null and never returns "cookie-session" or a raw JWT', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, fullName: 'Test Client', userType: 'client' }));
    expect(getToken()).toBeNull();
    expect(getToken()).not.toBe('cookie-session');
  });

  it('never attaches Authorization: Bearer or cookie-session headers on outgoing REST requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/csrf')) {
        return new Response(JSON.stringify({ success: true, data: { csrfToken: 'test-csrf' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    setUser({ id: 1, fullName: 'Test Client', userType: 'client' });

    await serviceRequestAPI.getClientRequests();
    await notificationAPI.getNotifications();
    await adminAPI.getDashboardStats();
    await userProfileAPI.getOnboardingProgress();

    for (const call of fetchSpy.mock.calls) {
      const options = call[1] || {};
      const headers = options.headers;
      let authHeader = null;

      if (headers) {
        if (typeof headers.get === 'function') {
          authHeader = headers.get('Authorization') || headers.get('authorization');
        } else if (typeof headers === 'object') {
          authHeader = headers.Authorization || headers.authorization;
        }
      }

      expect(authHeader).toBeNull();
      expect(JSON.stringify(options)).not.toContain('cookie-session');
    }
  });

  it('returns valid empty states for Client with zero requests, notifications, and conversations', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/csrf')) {
        return new Response(JSON.stringify({ success: true, data: { csrfToken: 'test-csrf' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/service-requests/client')) {
        return new Response(JSON.stringify({ success: true, data: { requests: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/notifications')) {
        return new Response(JSON.stringify({ success: true, data: { notifications: [], unreadCount: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/messages')) {
        return new Response(JSON.stringify({ success: true, data: { conversations: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
    });

    setUser({ id: 10, fullName: 'New Client', userType: 'client' });

    const requestsRes = await serviceRequestAPI.getClientRequests();
    expect(requestsRes.success).toBe(true);
    expect(requestsRes.data.requests).toEqual([]);

    const notificationsRes = await notificationAPI.getNotifications();
    expect(notificationsRes.success).toBe(true);
    expect(notificationsRes.data.notifications).toEqual([]);
    expect(notificationsRes.data.unreadCount).toBe(0);

    const conversationsRes = await messageAPI.listConversations();
    expect(conversationsRes.success).toBe(true);
    expect(conversationsRes.data.conversations).toEqual([]);

    // Local user cache must remain intact
    expect(getUser()).not.toBeNull();
    expect(getUser().fullName).toBe('New Client');
  });

  it('returns valid empty states for Admin with zero statistics, verifications, credentials, and reports', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/csrf')) {
        return new Response(JSON.stringify({ success: true, data: { csrfToken: 'test-csrf' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/admin/dashboard-stats')) {
        return new Response(JSON.stringify({ success: true, data: { totalUsers: 1, pendingVerifications: 0, reports: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/admin/verification-requests')) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/admin/provider-credentials')) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/admin/reports')) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
    });

    setUser({ id: 99, fullName: 'System Admin', userType: 'admin' });

    const statsRes = await adminAPI.getDashboardStats();
    expect(statsRes.success).toBe(true);

    const verificationsRes = await adminAPI.getVerificationRequests();
    expect(verificationsRes.success).toBe(true);
    expect(verificationsRes.data).toEqual([]);

    const credentialsRes = await adminAPI.getProviderCredentials();
    expect(credentialsRes.success).toBe(true);
    expect(credentialsRes.data).toEqual([]);

    const reportsRes = await adminAPI.getReports();
    expect(reportsRes.success).toBe(true);
    expect(reportsRes.data).toEqual([]);

    // Admin session must remain logged in
    expect(getUser()).not.toBeNull();
    expect(getUser().userType).toBe('admin');
  });

  it('does NOT clear localStorage.user or log out on transient 500 server errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/csrf')) {
        return new Response(JSON.stringify({ success: true, data: { csrfToken: 'test-csrf' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: false, message: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    setUser({ id: 5, fullName: 'Valid Client', userType: 'client' });

    await expect(serviceRequestAPI.getClientRequests()).rejects.toThrow();

    // Session cache must NOT be wiped by 500 error
    expect(getUser()).not.toBeNull();
    expect(getUser().fullName).toBe('Valid Client');
  });

  it('fetches role-aware onboarding progress for clients and providers', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/csrf')) {
        return new Response(JSON.stringify({ success: true, data: { csrfToken: 'test-csrf' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/user/onboarding-progress')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            userType: 'client',
            isComplete: false,
            completedCount: 1,
            totalCount: 3,
            completionPercentage: 33,
            tasks: [
              { id: 'email_verified', completed: true, titleKey: 'checklistVerifyEmail' },
              { id: 'profile_info', completed: false, titleKey: 'checklistCompleteProfile' },
              { id: 'first_request', completed: false, titleKey: 'checklistFirstRequest' },
            ],
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    setUser({ id: 12, fullName: 'Onboarding Client', userType: 'client' });

    const progress = await userProfileAPI.getOnboardingProgress();
    expect(progress.success).toBe(true);
    expect(progress.data.isComplete).toBe(false);
    expect(progress.data.completedCount).toBe(1);
    expect(progress.data.tasks).toHaveLength(3);
  });
});
