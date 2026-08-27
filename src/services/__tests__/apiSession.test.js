import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../utils/errors';
import { getUser, setUser } from '../api';

describe('API session hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('normalizes a numeric-string stored user id', () => {
    localStorage.setItem('user', JSON.stringify({
      id: '12',
      fullName: 'Client User',
      email: 'client@example.com',
      userType: 'client',
    }));

    expect(getUser()).toMatchObject({ id: 12, userType: 'client' });
  });

  it('clears an invalid stored session instead of throwing', () => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', '{broken json');

    expect(getUser()).toBeNull();
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('rejects invalid user objects before persisting them', () => {
    expect(() => setUser({ id: 1, userType: 'unknown-role' })).toThrow(ApiError);
    expect(localStorage.getItem('user')).toBeNull();
  });
});
