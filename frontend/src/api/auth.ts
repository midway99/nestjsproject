export interface User {
  id: string;
  email: string;
  name: string;
  lastName: string | null;
  role: 'user' | 'admin';
}

export interface UpdateProfileData {
  name: string;
  lastName: string;
}

export interface RegisterData {
  email: string;
  name: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

interface ApiErrorBody {
  message?: string | string[];
}

async function request<T>(
  url: string,
  data: object,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = (await response.json()) as T | ApiErrorBody;

  if (!response.ok) {
    const message = (body as ApiErrorBody).message;
    throw new Error(
      Array.isArray(message)
        ? message.join('. ')
        : message || 'Не удалось выполнить запрос',
    );
  }

  return body as T;
}

export const authApi = {
  register: (data: RegisterData) => request<User>('/auth/register', data),
  login: (data: LoginData) => request<User>('/auth/login', data),
  me: async () => {
    const response = await fetch('/auth/me');
    if (!response.ok) return null;
    return (await response.json()) as User;
  },
  updateProfile: (data: UpdateProfileData) =>
    request<User>('/auth/me', data, 'PATCH'),
  logout: () => request<{ loggedOut: true }>('/auth/logout', {}),
};
