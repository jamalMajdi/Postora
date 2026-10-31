import { getInitData } from './telegramSdk.js';

/**
 * عميل API للـ Mini App.
 *
 * قرارات أمنية:
 *  - لا يُخزَّن أي توكن بوت في الواجهة (غير موجود أصلًا).
 *  - الهوية تُثبت عبر initData الذي يُتحقق منه الخادم فقط.
 *  - التوكن الناتج (JWT) يُحفظ في الذاكرة (لا localStorage) لتقليل البصمة.
 *  - لا نستخدم localStorage لمحتوى المستخدم.
 */

const state = {
  token: null,
  tokenExpiresAt: 0
};

/**
 * عنوان الـ API.
 *
 * الافتراضي "" ⇒ مسارات نسبية (`/api/...`)، وهذا هو الوضع الموصى به:
 *   - في التطوير: Vite يمرّر `/api` إلى الخادم المحلي (vite.config.js).
 *   - على Vercel: `vercel.json` يمرّر `/api` إلى الـ Backend (rewrites).
 *
 * يمكن تجاوزه عند الحاجة إلى استدعاء الخادم مباشرة من نطاق آخر:
 *   VITE_API_BASE_URL=https://api.example.com
 * (يتطلب حينها إضافة أصل الواجهة إلى CORS_ORIGINS في الخادم)
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const url = (path) => `${API_BASE}/api${path}`;

export class ApiError extends Error {
  constructor({ code, message, status, details }) {
    super(message || code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** يجلب جلسة جديدة من initData. */
export async function createSession() {
  const initData = getInitData();

  if (!initData) {
    // بيئة تطوير بدون تلجرام
    throw new ApiError({
      code: 'AUTH_MISSING_INIT_DATA',
      message: 'يجب فتح التطبيق من داخل تلجرام.',
      status: 401
    });
  }

  const response = await fetch(url('/auth/session'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    throw new ApiError({
      code: body?.error?.code || 'INTERNAL_ERROR',
      message: body?.error?.message,
      status: response.status,
      details: body?.error?.details
    });
  }

  state.token = body.data.token;
  state.tokenExpiresAt = Date.now() + (body.data.expiresIn ?? 3600) * 1000;
  return body.data;
}

function authHeaders() {
  return state.token ? { authorization: `Bearer ${state.token}` } : {};
}

/**
 * نداء موحّد للـ API مع تجديد الجلسة مرة واحدة عند 401.
 */
export async function api(path, { method = 'GET', body, retryOnAuthFailure = true } = {}) {
  const response = await fetch(url(path), {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...authHeaders()
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401 && retryOnAuthFailure) {
    state.token = null;
    await createSession();
    return api(path, { method, body, retryOnAuthFailure: false });
  }

  if (!response.ok || payload.ok === false) {
    throw new ApiError({
      code: payload?.error?.code || 'INTERNAL_ERROR',
      message: payload?.error?.message,
      status: response.status,
      details: payload?.error?.details
    });
  }

  return payload.data ?? payload;
}

/* ------------------------------ نقاط النهاية ------------------------------ */

export const apiClient = {
  me: () => api('/me'),
  setLocale: (locale) => api('/me/locale', { method: 'PATCH', body: { locale } }),

  listDrafts: () => api('/drafts'),
  createDraft: (payload) => api('/drafts', { method: 'POST', body: payload }),
  updateDraft: (id, payload) => api(`/drafts/${id}`, { method: 'PATCH', body: payload }),
  deleteDraft: (id) => api(`/drafts/${id}`, { method: 'DELETE' }),

  listChannels: () => api('/channels'),
  connectChannel: (chatRef) => api('/channels', { method: 'POST', body: { chatRef } }),
  verifyChannel: (id) => api(`/channels/${id}/verify`, { method: 'POST' }),
  disconnectChannel: (id) => api(`/channels/${id}`, { method: 'DELETE' }),

  preview: (contentMarkdown) => api('/preview', { method: 'POST', body: { contentMarkdown } }),

  publish: (payload) => api('/publications', { method: 'POST', body: payload }),

  listPublications: () => api('/publications'),
  deletePublication: (id) => api(`/publications/${id}`, { method: 'DELETE' }),

  isAuthenticated: () => Boolean(state.token),
  clearSession: () => {
    state.token = null;
    state.tokenExpiresAt = 0;
  }
};
