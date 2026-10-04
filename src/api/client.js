const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const TOKEN_KEY = 'barberflow_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const error = new Error(data?.error || 'Error en la solicitud.');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function authRequest(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error || 'Error en la solicitud.' };
  }
  return data;
}

export const api = {
  register: (body) => authRequest('/auth/register', body),
  login: (body) => authRequest('/auth/login', body),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  createEmployee: async (body) => {
    try {
      return await request('/auth/employees', { method: 'POST', body: JSON.stringify(body) });
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
  listEmployees: () => request('/auth/employees'),

  getBusiness: () => request('/businesses/me'),
  patchBusiness: (body) => request('/businesses/me', { method: 'PATCH', body: JSON.stringify(body) }),

  listClients: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/clients${q ? `?${q}` : ''}`);
  },
  getClient: (id) => request(`/clients/${id}`),

  listServices: () => request('/services'),
  createService: (body) => request('/services', { method: 'POST', body: JSON.stringify(body) }),
  updateService: (id, body) => request(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteService: (id) => request(`/services/${id}`, { method: 'DELETE' }),

  listProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/products${q ? `?${q}` : ''}`);
  },
  createProduct: (body) => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  adjustProductStock: (id, body) => request(`/products/${id}/adjust-stock`, { method: 'POST', body: JSON.stringify(body) }),

  listAppointments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/appointments${q ? `?${q}` : ''}`);
  },
  createAppointment: (body) => request('/appointments', { method: 'POST', body: JSON.stringify(body) }),
  updateAppointment: (id, body) => request(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  listProductSales: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/product-sales${q ? `?${q}` : ''}`);
  },
  createProductSale: (body) => request('/product-sales', { method: 'POST', body: JSON.stringify(body) }),

  dashboardAnalytics: (date) => request(`/analytics/dashboard${date ? `?date=${date}` : ''}`),
  revenueAnalytics: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/analytics/revenue${q ? `?${q}` : ''}`);
  },
  metricsAnalytics: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/analytics/metrics${q ? `?${q}` : ''}`);
  },
  alertsAnalytics: () => request('/analytics/alerts'),

  masterBusinesses: (search = '') => request(`/master/businesses${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  masterUsers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/master/users${q ? `?${q}` : ''}`);
  },
};

// Fecha local (YYYY-MM-DD). toISOString() usa UTC y en la noche de Colombia ya marca el día siguiente.
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
