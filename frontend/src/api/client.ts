const API_PREFIX = '/api/v1';

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('jwt_token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_PREFIX}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || 'Something went wrong');
  }

  return result as T;
}

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: credentials.email, passwordPlain: credentials.password }),
      }),
    changePassword: (data: { oldPassword: string; newPassword: string }) =>
      request<any>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPasswordPlain: data.oldPassword, newPasswordPlain: data.newPassword }),
      }),
    updateProfile: (data: { email?: string; name?: string }) =>
      request<any>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    forgotPassword: (email: string) =>
      request<any>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (data: { token: string; newPassword: string }) =>
      request<any>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: data.token, newPasswordPlain: data.newPassword }),
      }),
  },
  borrowers: {
    list: (search?: string) =>
      request<any[]>(`/borrowers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    getOne: (id: string) => request<any>(`/borrowers/${id}`),
    create: (data: any) =>
      request<any>('/borrowers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      request<any>(`/borrowers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<any>(`/borrowers/${id}`, {
        method: 'DELETE',
      }),
  },
  loans: {
    list: (filters?: { status?: string; borrowerId?: string; createdById?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.borrowerId) params.set('borrowerId', filters.borrowerId);
      if (filters?.createdById) params.set('createdById', filters.createdById);
      const query = params.toString() ? `?${params.toString()}` : '';
      return request<any[]>(`/loans${query}`);
    },
    getOne: (id: string) => request<any>(`/loans/${id}`),
    create: (data: any) =>
      request<any>('/loans', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    setStatus: (id: string, status: string) =>
      request<any>(`/loans/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },
  repayments: {
    listForLoan: (loanId: string) => request<any[]>(`/repayments/loan/${loanId}`),
    create: (data: { loanId: string; amount: number; paymentDate: string; paymentMethod: string }) =>
      request<any>('/repayments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  reminders: {
    trigger: () =>
      request<any>('/reminders/trigger', {
        method: 'POST',
      }),
  },
  dashboard: {
    getMetrics: () => request<any>('/dashboard/metrics'),
  },
  notifications: {
    list: (filters?: { channel?: string; status?: string }) => {
      const params = new URLSearchParams();
      if (filters?.channel) params.set('channel', filters.channel);
      if (filters?.status) params.set('status', filters.status);
      const query = params.toString() ? `?${params.toString()}` : '';
      return request<any[]>(`/notifications${query}`);
    },
  },
  users: {
    list: () => request<any[]>('/users'),
    create: (data: any) =>
      request<any>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      request<any>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<any>(`/users/${id}`, {
        method: 'DELETE',
      }),
  },
  settings: {
    get: () => request<any>('/settings'),
    update: (data: any) =>
      request<any>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  audit: {
    list: (filters?: { userId?: string; entity?: string; action?: string }) => {
      const params = new URLSearchParams();
      if (filters?.userId) params.set('userId', filters.userId);
      if (filters?.entity) params.set('entity', filters.entity);
      if (filters?.action) params.set('action', filters.action);
      const query = params.toString() ? `?${params.toString()}` : '';
      return request<any>(`/audit${query}`);
    },
  },
  messages: {
    getLoanMessages: (loanId: string) => request<any>(`/loans/${loanId}/messages`),
    sendMessage: (loanId: string, message: string) =>
      request<any>(`/loans/${loanId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
    markAsRead: (loanId: string) =>
      request<any>(`/loans/${loanId}/messages/read`, {
        method: 'PATCH',
      }),
  },
};

