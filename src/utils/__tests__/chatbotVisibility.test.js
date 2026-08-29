import { describe, expect, it } from 'vitest';
import { shouldShowChatbotForContext } from '../chatbotVisibility';

describe('chatbot visibility policy', () => {
  it('shows the assistant on useful discovery routes for guests and clients', () => {
    expect(shouldShowChatbotForContext({ pathname: '/', userType: null })).toBe(true);
    expect(shouldShowChatbotForContext({ pathname: '/feed', userType: 'client' })).toBe(true);
    expect(shouldShowChatbotForContext({ pathname: '/client-dashboard', userType: 'client' })).toBe(true);
    expect(shouldShowChatbotForContext({ pathname: '/provider/77', userType: 'client' })).toBe(true);
  });

  it('hides the assistant from provider workspaces and all admin contexts', () => {
    expect(shouldShowChatbotForContext({ pathname: '/dashboard', userType: 'tradesperson' })).toBe(false);
    expect(shouldShowChatbotForContext({ pathname: '/provider-availability', userType: 'tradesperson' })).toBe(false);
    expect(shouldShowChatbotForContext({ pathname: '/provider/77', userType: 'tradesperson' })).toBe(false);
    expect(shouldShowChatbotForContext({ pathname: '/admin/dashboard', userType: 'admin' })).toBe(false);
  });

  it('does not show the assistant on unrelated client/auth/account pages', () => {
    expect(shouldShowChatbotForContext({ pathname: '/requests', userType: 'client' })).toBe(false);
    expect(shouldShowChatbotForContext({ pathname: '/notifications', userType: 'client' })).toBe(false);
    expect(shouldShowChatbotForContext({ pathname: '/client-settings', userType: 'client' })).toBe(false);
    expect(shouldShowChatbotForContext({ pathname: '/login', userType: null })).toBe(false);
  });
});
