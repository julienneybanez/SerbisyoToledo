import { ApiError } from '../utils/errors';
import { normalizeStoredUser } from '../utils/runtimeGuards';

// API Configuration
const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim();

// Production browser traffic must stay same-origin so HttpOnly session cookies are
// first-party on Vercel. VITE_API_URL remains useful for development only.
export const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (configuredApiUrl || 'http://localhost:5000/api');

let csrfToken = null;
let csrfBootstrapPromise = null;

const getCsrfToken = async () => {
  if (csrfToken) return csrfToken;
  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = globalThis.fetch(`${API_BASE_URL}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data?.success || !data?.data?.csrfToken) {
          throw new ApiError(data?.message || 'Unable to initialize request security.', {
            status: response.status,
            code: data?.code || 'CSRF_BOOTSTRAP_FAILED',
          });
        }
        csrfToken = data.data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }
  return csrfBootstrapPromise;
};

const apiFetch = async (url, options = {}, retryCsrf = true) => {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  if (isMutation) {
    const token = await getCsrfToken();
    headers.set('X-CSRF-Token', token);
  }

  const response = await globalThis.fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 403 && retryCsrf) {
    const clone = response.clone();
    try {
      const data = await clone.json();
      if (data?.code === 'CSRF_TOKEN_INVALID') {
        csrfToken = null;
        await getCsrfToken();
        return apiFetch(url, options, false);
      }
    } catch {
      // Let the normal response handler report the original error.
    }
  }

  return response;
};

// Helper function to handle API responses
const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();

  let data = null;
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = null;
    }
  }

  const looksLikeHtml = contentType.includes('text/html')
    || /^\s*<!doctype html/i.test(rawBody)
    || /^\s*<html/i.test(rawBody);

  if (looksLikeHtml) {
    throw new ApiError(
      'The app received HTML instead of API data. Check VITE_API_URL or your production API rewrite configuration.',
      { status: response.status, code: 'NON_JSON_API_RESPONSE' },
    );
  }

  if (!data) {
    throw new ApiError('The server returned an invalid API response.', {
      status: response.status,
      code: 'INVALID_API_RESPONSE',
    });
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined' && localStorage.getItem('user')) {
      removeToken();
      window.dispatchEvent(new Event('authChange'));
    }

    throw new ApiError(data.message || 'An error occurred', {
      status: response.status,
      code: data.code || null,
      errors: data.errors || [],
    });
  }

  return data;
};

// Authentication is strictly HttpOnly cookie-based. Browser JavaScript never receives or stores the JWT.
export const getToken = () => {
  localStorage.removeItem('authToken');
  return null;
};

export const setToken = () => {
  localStorage.removeItem('authToken');
};

export const removeToken = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  csrfToken = null;
};

export const clearAuthSession = ({ preserveRedirect = true } = {}) => {
  removeToken();

  if (!preserveRedirect) {
    sessionStorage.removeItem('redirectAfterLogin');
  }

  window.dispatchEvent(new Event('authChange'));
};

export const getUser = () => {
  const rawUser = localStorage.getItem('user');
  if (!rawUser) return null;

  try {
    const normalizedUser = normalizeStoredUser(JSON.parse(rawUser));
    if (!normalizedUser) {
      removeToken();
      return null;
    }
    return normalizedUser;
  } catch {
    removeToken();
    return null;
  }
};

export const setUser = (user) => {
  const normalizedUser = normalizeStoredUser(user);
  if (!normalizedUser) {
    throw new ApiError('The server returned invalid user data.', {
      code: 'INVALID_USER_DATA',
    });
  }

  // This is a non-secret display/routing cache only. /auth/me is authoritative.
  localStorage.setItem('user', JSON.stringify(normalizedUser));
};

export const isAuthenticated = () => Boolean(getUser());

// Auth API calls
export const authAPI = {
  // Register a new user
  register: async (userData) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    const data = await handleResponse(response);
    
    if (data.success) {
      removeToken();
    }
    
    return data;
  },

  // Login user
  login: async (credentials) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    const data = await handleResponse(response);
    
    if (data.success && data.data?.user) {
      csrfToken = null;
      setUser(data.data.user);
      window.dispatchEvent(new Event('authChange'));
    }

    return data;
  },

  // Request password reset email
  forgotPassword: async (payload) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return handleResponse(response);
  },

  // Reset password with token
  resetPassword: async (token, payload) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/reset-password/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return handleResponse(response);
  },

  // Get current user profile
  getMe: async () => {
    const response = await apiFetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await handleResponse(response);
    if (data.success && data.data?.user) {
      setUser(data.data.user);
      window.dispatchEvent(new Event('authChange'));
    }
    return data;
  },

  // Logout user
  logout: async () => {
    try {
      await apiFetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      removeToken();
      window.dispatchEvent(new Event('authChange'));
    }
  },

  getSocketTicket: async () => {
    const response = await apiFetch(`${API_BASE_URL}/auth/socket-ticket`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  // Update user profile
  updateProfile: async (profileData) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/update-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });
    
    const data = await handleResponse(response);
    
    // Update stored user data
    if (data.success && data.data) {
      setUser(data.data.user);
    }
    
    return data;
  },
};

export const verificationAPI = {
  verifyEmail: async (token) => {
    const params = new URLSearchParams({ token });
    const response = await apiFetch(`${API_BASE_URL}/auth/verify-email?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return handleResponse(response);
  },

  resendVerification: async (payload) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return handleResponse(response);
  },
};

// Admin API calls
export const adminAPI = {
  // Get dashboard statistics
  getDashboardStats: async () => {
    const response = await apiFetch(`${API_BASE_URL}/admin/dashboard-stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get all users
  getAllUsers: async () => {
    const response = await apiFetch(`${API_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get user by ID
  getUserById: async (id) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Update user status
  updateUserStatus: async (id, statusData) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/users/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(statusData),
    });
    return handleResponse(response);
  },

  // Get user activity summary
  getUserActivity: async (id) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/users/${id}/activity`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get all verification requests
  getVerificationRequests: async () => {
    const response = await apiFetch(`${API_BASE_URL}/admin/verification-requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  getVerificationDocument: async (id, documentType) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/verification-requests/${id}/documents/${documentType}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  // Review verification request
  reviewVerificationRequest: async (id, reviewData) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/verification-requests/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reviewData),
    });
    return handleResponse(response);
  },

  // Get all reports
  getReports: async () => {
    const response = await apiFetch(`${API_BASE_URL}/admin/reports`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get provider credentials for admin review
  getProviderCredentials: async () => {
    const response = await apiFetch(`${API_BASE_URL}/admin/provider-credentials`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Review provider credential (approve/reject/expire)
  reviewProviderCredential: async (id, payload) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/provider-credentials/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  // Update report status
  updateReportStatus: async (id, updateData) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/reports/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    return handleResponse(response);
  },

  // Delete user
  deleteUser: async (id) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },
};

// Service Profile API calls
export const serviceProfileAPI = {
  // Create or update service profile
  createProfile: async (formData) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/create`, {
      method: 'POST',
      body: formData,
    });
    
    return handleResponse(response);
  },

  // Get all published service profiles
  getAllProfiles: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.category) params.append('category', filters.category);
    if (filters.serviceType) params.append('serviceType', filters.serviceType);
    if (filters.location) params.append('location', filters.location);
    if (filters.minPrice) params.append('minPrice', filters.minPrice);
    if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
    if (filters.minRating) params.append('minRating', filters.minRating);
    if (filters.search) params.append('search', filters.search);

    const response = await apiFetch(`${API_BASE_URL}/service-profiles/all?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return handleResponse(response);
  },

  // Get canonical service taxonomy (categories + service types)
  getTaxonomy: async () => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/taxonomy`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return handleResponse(response);
  },

  // Get single profile by ID
  getProfileById: async (id) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return handleResponse(response);
  },

  // Get available booking slots for a provider/date
  getAvailableSlots: async (id, { date, duration, bookingType = 'one_day', endDate = null, dates = [], excludeRequestId = null }) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (duration) params.set('duration', String(duration));
    if (bookingType) params.set('bookingType', bookingType);
    if (endDate) params.set('endDate', endDate);
    if (Array.isArray(dates) && dates.length > 0) params.set('dates', dates.join(','));
    if (excludeRequestId) params.set('excludeRequestId', String(excludeRequestId));

    const response = await apiFetch(`${API_BASE_URL}/service-profiles/${id}/available-slots?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return handleResponse(response);
  },

  // Get dates with at least one available slot for a provider
  getAvailableDates: async (id, { fromDate, toDate, duration, excludeRequestId = null }) => {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (duration) params.set('duration', String(duration));
    if (excludeRequestId) params.set('excludeRequestId', String(excludeRequestId));

    const response = await apiFetch(`${API_BASE_URL}/service-profiles/${id}/available-dates?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return handleResponse(response);
  },

  // Get recommended providers for assistant/chatbot flows
  getRecommendations: async (filters = {}) => {
    const params = new URLSearchParams();

    if (filters.category) params.set('category', filters.category);
    if (filters.location) params.set('location', filters.location);
    if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
    if (filters.minRating) params.set('minRating', String(filters.minRating));
    if (filters.search) params.set('search', filters.search);
    if (filters.language) params.set('language', filters.language);
    if (filters.availabilityDate) params.set('availabilityDate', filters.availabilityDate);
    if (filters.duration) params.set('duration', String(filters.duration));
    if (filters.limit) params.set('limit', String(filters.limit));

    const response = await apiFetch(`${API_BASE_URL}/service-profiles/recommendations?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return handleResponse(response);
  },

  // Get current user's profile
  getMyProfile: async () => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/user/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return handleResponse(response);
  },

  // Toggle profile publish status
  togglePublish: async (isPublished) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/toggle-publish`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isPublished }),
    });
    
    return handleResponse(response);
  },

  // Provider availability
  getMyAvailability: async () => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/availability/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  saveMyAvailability: async (payload) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/availability/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  addAvailabilityException: async (payload) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/availability/me/exceptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  deleteAvailabilityException: async (exceptionId) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/availability/me/exceptions/${exceptionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Provider languages
  getMyLanguages: async () => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/languages/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  updateMyLanguages: async (languages) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/languages/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ languages }),
    });
    return handleResponse(response);
  },

  // Provider credentials
  getMyCredentials: async () => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/credentials/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  createCredential: async (formData) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/credentials/me`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  submitCredentialForReview: async (credentialId) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/credentials/me/${credentialId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Completed request linkage for portfolio
  getEligibleCompletedRequests: async () => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/portfolio/completed-requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  createPortfolioFromRequest: async (payload) => {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    const headers = {};

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await apiFetch(`${API_BASE_URL}/service-profiles/portfolio/from-request`, {
      method: 'POST',
      headers,
      body: isFormData ? payload : JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  updateCompletedPortfolioItemImage: async (itemId, formData) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/portfolio/item/${itemId}/image`, {
      method: 'PUT',
      body: formData,
    });
    return handleResponse(response);
  },

  // Get portfolio for editing
  getMyPortfolio: async () => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/portfolio/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Update portfolio details (about me, skills, response time)
  updatePortfolioDetails: async (data) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/portfolio/details`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Add portfolio image
  addPortfolioImage: async (formData) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/portfolio/image`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  // Delete portfolio image
  deletePortfolioImage: async (imageId) => {
    const response = await apiFetch(`${API_BASE_URL}/service-profiles/portfolio/image/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },
};

// Assistant API (provider-agnostic preparation)
export const assistantAPI = {
  getCapabilities: async () => {
    const response = await apiFetch(`${API_BASE_URL}/assistant/capabilities`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  sendMessage: async ({ message, locale = 'en', context = {}, history = [] }) => {
    const response = await apiFetch(`${API_BASE_URL}/assistant/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, locale, context, history }),
    });
    return handleResponse(response);
  },
};

// Service Request API calls
export const serviceRequestAPI = {
  // Create a new service request
  createRequest: async (requestData) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    return handleResponse(response);
  },

  // Get client's sent requests
  getClientRequests: async () => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/client`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get provider's received requests
  getProviderRequests: async () => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/provider`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get single request by ID
  getRequestById: async (requestId) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Update request status
  updateStatus: async (requestId, status, reason = null, cancellation = null) => {
    const payload = reason == null ? { status } : { status, reason };
    if (cancellation && typeof cancellation === 'object') {
      payload.cancellationReason = cancellation.cancellationReason;
      payload.cancellationReasonOther = cancellation.cancellationReasonOther;
    }
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  // Create reschedule proposal
  proposeReschedule: async (requestId, payload) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}/reschedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  // Respond to reschedule proposal
  respondReschedule: async (requestId, rescheduleId, action) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}/reschedules/${rescheduleId}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });
    return handleResponse(response);
  },

  getPhoneShare: async (requestId) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}/phone-share`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  requestPhoneShare: async (requestId) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}/phone-share/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  respondPhoneShare: async (requestId, action) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}/phone-share/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    return handleResponse(response);
  },

  archiveRequest: async (requestId) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  unarchiveRequest: async (requestId) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}/archive`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  // Create a review for a completed request (client)
  createReview: async (requestId, { rating, comment }) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating, comment }),
    });
    return handleResponse(response);
  },

  // Report user for a request interaction
  createReport: async (requestId, formData) => {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}/report`, {
      method: 'POST',
      body: formData,
    });

    return handleResponse(response);
  },
};

export const messageAPI = {
  listConversations: async () => {
    const response = await apiFetch(`${API_BASE_URL}/messages`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  getUnreadCount: async () => {
    const response = await apiFetch(`${API_BASE_URL}/messages/unread-count`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  openRequestConversation: async (requestId) => {
    const response = await apiFetch(`${API_BASE_URL}/messages/request/${requestId}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  getMessages: async (conversationId, { beforeId = null, limit = 60 } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (beforeId) params.set('beforeId', String(beforeId));
    const response = await apiFetch(`${API_BASE_URL}/messages/${conversationId}/messages?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  sendMessage: async (conversationId, message) => {
    const response = await apiFetch(`${API_BASE_URL}/messages/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return handleResponse(response);
  },

  markRead: async (conversationId) => {
    const response = await apiFetch(`${API_BASE_URL}/messages/${conversationId}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },
};

// Notification API calls
export const notificationAPI = {
  // Get all notifications
  getNotifications: async (limit = 20, offset = 0) => {
    const response = await apiFetch(`${API_BASE_URL}/notifications?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get unread count
  getUnreadCount: async () => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/unread-count`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Mark single notification as read
  markAsRead: async (notificationId) => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Mark all as read
  markAllAsRead: async () => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Delete notification
  deleteNotification: async (notificationId) => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Clear all notifications
  clearAll: async () => {
    const response = await apiFetch(`${API_BASE_URL}/notifications`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },
};

// User Profile API calls (for editing profile)
export const userProfileAPI = {
  // Get current user profile with photo
  getProfile: async () => {
    const response = await apiFetch(`${API_BASE_URL}/user/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get role-aware onboarding progress
  getOnboardingProgress: async () => {
    const response = await apiFetch(`${API_BASE_URL}/user/onboarding-progress`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  updatePresence: async (online = true) => {
    const response = await apiFetch(`${API_BASE_URL}/user/presence`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ online: Boolean(online) }),
    });

    return handleResponse(response);
  },

  // Update profile (name, phone, address, bio, photo)
  updateProfile: async (formData) => {
    const response = await apiFetch(`${API_BASE_URL}/user/profile`, {
      method: 'PATCH',
      body: formData,
    });
    const data = await handleResponse(response);
    
    // Update stored user data with new profile info
    if (data.success && data.data) {
      const currentUser = getUser();
      if (currentUser) {
        setUser({
          ...currentUser,
          fullName: data.data.fullName,
          phone: data.data.phone,
          address: data.data.address,
          bio: data.data.bio,
          profileImage: data.data.profilePhoto
        });
        window.dispatchEvent(new Event('authChange'));
      }
    }
    
    return data;
  },

  // Remove profile photo
  removePhoto: async () => {
    const response = await apiFetch(`${API_BASE_URL}/user/profile/photo`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await handleResponse(response);
    
    if (data.success) {
      const currentUser = getUser();
      if (currentUser) {
        setUser({
          ...currentUser,
          profileImage: null
        });
        window.dispatchEvent(new Event('authChange'));
      }
    }
    
    return data;
  },

  // Submit verification request (service provider)
  submitVerificationRequest: async (formData) => {
    const response = await apiFetch(`${API_BASE_URL}/user/verification-request`, {
      method: 'POST',
      body: formData,
    });

    return handleResponse(response);
  },
};

export default authAPI;
