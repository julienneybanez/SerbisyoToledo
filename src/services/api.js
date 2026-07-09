// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper function to handle API responses
const handleResponse = async (response) => {
  const data = await response.json();
  
  if (!response.ok) {
    throw {
      status: response.status,
      message: data.message || 'An error occurred',
      code: data.code || null,
      errors: data.errors || []
    };
  }
  
  return data;
};

// Get stored token
export const getToken = () => {
  return localStorage.getItem('authToken');
};

// Set stored token
export const setToken = (token) => {
  localStorage.setItem('authToken', token);
};

// Remove stored token
export const removeToken = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};

// Get stored user
export const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

// Set stored user
export const setUser = (user) => {
  localStorage.setItem('user', JSON.stringify(user));
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getToken();
};

// Auth API calls
export const authAPI = {
  // Register a new user
  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    const data = await handleResponse(response);
    
    // Store token and user data
    if (data.success && data.data) {
      setToken(data.data.token);
      setUser(data.data.user);
      // Notify components of auth change
      window.dispatchEvent(new Event('authChange'));
    }
    
    return data;
  },

  // Login user
  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    const data = await handleResponse(response);
    
    // Store token and user data
    if (data.success && data.data) {
      setToken(data.data.token);
      setUser(data.data.user);
      // Notify components of auth change
      window.dispatchEvent(new Event('authChange'));
    }
    
    return data;
  },

  // Get current user profile
  getMe: async () => {
    const token = getToken();
    
    if (!token) {
      throw { message: 'No authentication token found' };
    }
    
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await handleResponse(response);
    
    // Update stored user data
    if (data.success && data.data) {
      setUser(data.data.user);
    }
    
    return data;
  },

  // Logout user
  logout: async () => {
    const token = getToken();
    
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Always clear local storage
      removeToken();
    }
  },

  // Update user profile
  updateProfile: async (profileData) => {
    const token = getToken();
    
    if (!token) {
      throw { message: 'No authentication token found' };
    }
    
    const response = await fetch(`${API_BASE_URL}/auth/update-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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

// Admin API calls
export const adminAPI = {
  // Get dashboard statistics
  getDashboardStats: async () => {
    const token = getToken();
    
    if (!token) {
      throw { message: 'No authentication token found' };
    }
    
    const response = await fetch(`${API_BASE_URL}/admin/dashboard-stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return handleResponse(response);
  },

  // Get all users
  getAllUsers: async () => {
    const token = getToken();
    
    if (!token) {
      throw { message: 'No authentication token found' };
    }
    
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return handleResponse(response);
  },

  // Get user by ID
  getUserById: async (id) => {
    const token = getToken();
    
    if (!token) {
      throw { message: 'No authentication token found' };
    }
    
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return handleResponse(response);
  },

  // Update user status
  updateUserStatus: async (id, statusData) => {
    const token = getToken();
    
    if (!token) {
      throw { message: 'No authentication token found' };
    }
    
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(statusData),
    });
    
    return handleResponse(response);
  },

  // Get user activity summary
  getUserActivity: async (id) => {
    const token = getToken();

    if (!token) {
      throw { message: 'No authentication token found' };
    }

    const response = await fetch(`${API_BASE_URL}/admin/users/${id}/activity`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    return handleResponse(response);
  },

  // Get all verification requests
  getVerificationRequests: async () => {
    const token = getToken();

    if (!token) {
      throw { message: 'No authentication token found' };
    }

    const response = await fetch(`${API_BASE_URL}/admin/verification-requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    return handleResponse(response);
  },

  // Review verification request
  reviewVerificationRequest: async (id, reviewData) => {
    const token = getToken();

    if (!token) {
      throw { message: 'No authentication token found' };
    }

    const response = await fetch(`${API_BASE_URL}/admin/verification-requests/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(reviewData),
    });

    return handleResponse(response);
  },

  // Get all reports
  getReports: async () => {
    const token = getToken();

    if (!token) {
      throw { message: 'No authentication token found' };
    }

    const response = await fetch(`${API_BASE_URL}/admin/reports`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    return handleResponse(response);
  },

  // Update report status
  updateReportStatus: async (id, updateData) => {
    const token = getToken();

    if (!token) {
      throw { message: 'No authentication token found' };
    }

    const response = await fetch(`${API_BASE_URL}/admin/reports/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updateData),
    });

    return handleResponse(response);
  },

  // Delete user
  deleteUser: async (id) => {
    const token = getToken();
    
    if (!token) {
      throw { message: 'No authentication token found' };
    }
    
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return handleResponse(response);
  },
};

// Service Profile API calls
export const serviceProfileAPI = {
  // Create or update service profile
  createProfile: async (formData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-profiles/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    return handleResponse(response);
  },

  // Get all published service profiles
  getAllProfiles: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.category) params.append('category', filters.category);
    if (filters.location) params.append('location', filters.location);
    if (filters.minPrice) params.append('minPrice', filters.minPrice);
    if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
    if (filters.minRating) params.append('minRating', filters.minRating);
    if (filters.search) params.append('search', filters.search);

    const response = await fetch(`${API_BASE_URL}/service-profiles/all?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return handleResponse(response);
  },

  // Get single profile by ID
  getProfileById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/service-profiles/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return handleResponse(response);
  },

  // Get current user's profile
  getMyProfile: async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-profiles/user/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return handleResponse(response);
  },

  // Toggle profile publish status
  togglePublish: async (isPublished) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-profiles/toggle-publish`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ isPublished }),
    });
    
    return handleResponse(response);
  },

  // Get portfolio for editing
  getMyPortfolio: async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-profiles/portfolio/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Update portfolio details (about me, skills, response time)
  updatePortfolioDetails: async (data) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-profiles/portfolio/details`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Add portfolio image
  addPortfolioImage: async (formData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-profiles/portfolio/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    return handleResponse(response);
  },

  // Delete portfolio image
  deletePortfolioImage: async (imageId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-profiles/portfolio/image/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },
};

// Service Request API calls
export const serviceRequestAPI = {
  // Create a new service request
  createRequest: async (requestData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-requests/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestData),
    });
    return handleResponse(response);
  },

  // Get client's sent requests
  getClientRequests: async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-requests/client`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Get provider's received requests
  getProviderRequests: async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-requests/provider`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Get single request by ID
  getRequestById: async (requestId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-requests/${requestId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Update request status
  updateStatus: async (requestId, status) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-requests/${requestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    return handleResponse(response);
  },

  // Request discussion (client)
  requestDiscussion: async (requestId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-requests/${requestId}/request-discussion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Accept discussion (provider)
  acceptDiscussion: async (requestId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-requests/${requestId}/accept-discussion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Create a review for a completed request (client)
  createReview: async (requestId, { rating, comment }) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-requests/${requestId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ rating, comment }),
    });
    return handleResponse(response);
  },

  // Report user for a request interaction
  createReport: async (requestId, formData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/service-requests/${requestId}/report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    return handleResponse(response);
  },
};

// Notification API calls
export const notificationAPI = {
  // Get all notifications
  getNotifications: async (limit = 20, offset = 0) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/notifications?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Get unread count
  getUnreadCount: async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Mark single notification as read
  markAsRead: async (notificationId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Mark all as read
  markAllAsRead: async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Delete notification
  deleteNotification: async (notificationId) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Clear all notifications
  clearAll: async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },
};

// User Profile API calls (for editing profile)
export const userProfileAPI = {
  // Get current user profile with photo
  getProfile: async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Update profile (name, phone, address, bio, photo)
  updateProfile: async (formData) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let browser set it for FormData
      },
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
          profileImage: data.data.profilePhoto
        });
        window.dispatchEvent(new Event('authChange'));
      }
    }
    
    return data;
  },

  // Remove profile photo
  removePhoto: async () => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/user/profile/photo`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/user/verification-request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    return handleResponse(response);
  },
};

export default authAPI;
