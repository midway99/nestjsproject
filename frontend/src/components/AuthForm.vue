<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import {
  authApi,
  type LoginData,
  type RegisterData,
  type User,
} from '../api/auth';
import FinanceDashboard from './FinanceDashboard.vue';
import ProfileForm from './ProfileForm.vue';

type Mode = 'login' | 'register' | 'reset-request' | 'reset-confirm';

const mode = ref<Mode>('login');
const loading = ref(false);
const error = ref('');
const success = ref('');
const currentUser = ref<User | null>(null);
const showFinance = ref(false);
const showProfile = ref(false);
const form = reactive({ name: '', email: '', password: '' });
const resetForm = reactive({ email: '', token: '', password: '' });

function selectMode(nextMode: Mode) {
  mode.value = nextMode;
  error.value = '';
  success.value = '';
}

function applyHashRoute() {
  showFinance.value = window.location.hash === '#/finance';
  showProfile.value = window.location.hash === '#/profile';
}

function setView(view: 'home' | 'finance' | 'profile') {
  window.location.hash = view === 'home' ? '#/' : `#/${view}`;
  applyHashRoute();
}

async function submit() {
  loading.value = true;
  error.value = '';
  success.value = '';

  try {
    if (mode.value === 'register') {
      const data: RegisterData = {
        name: form.name,
        email: form.email,
        password: form.password,
      };
      const user = await authApi.register(data);
      success.value = `Аккаунт для ${user.email} создан. Теперь войдите.`;
      mode.value = 'login';
      form.password = '';
    } else {
      const data: LoginData = {
        email: form.email,
        password: form.password,
      };
      currentUser.value = await authApi.login(data);
      setView('home');
    }
  } catch (requestError) {
    error.value =
      requestError instanceof Error
        ? requestError.message
        : 'Произошла неизвестная ошибка';
  } finally {
    loading.value = false;
  }
}

async function requestReset() {
  loading.value = true;
  error.value = '';
  success.value = '';

  try {
    const result = await authApi.requestPasswordReset(resetForm.email);
    success.value = result.resetToken
      ? `${result.message}. Токен: ${result.resetToken}`
      : result.message;
    if (result.resetToken) resetForm.token = result.resetToken;
    mode.value = 'reset-confirm';
  } catch (requestError) {
    error.value =
      requestError instanceof Error
        ? requestError.message
        : 'Произошла неизвестная ошибка';
  } finally {
    loading.value = false;
  }
}

async function confirmReset() {
  loading.value = true;
  error.value = '';
  success.value = '';

  try {
    await authApi.resetPassword(resetForm.token, resetForm.password);
    success.value = 'Пароль обновлен. Теперь войдите с новым паролем.';
    mode.value = 'login';
    form.email = resetForm.email;
    form.password = '';
    resetForm.password = '';
  } catch (requestError) {
    error.value =
      requestError instanceof Error
        ? requestError.message
        : 'Произошла неизвестная ошибка';
  } finally {
    loading.value = false;
  }
}

async function logout() {
  try {
    await authApi.logout();
  } finally {
    currentUser.value = null;
    setView('home');
    form.password = '';
  }
}

onMounted(async () => {
  currentUser.value = await authApi.me();
  applyHashRoute();
  window.addEventListener('hashchange', applyHashRoute);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', applyHashRoute);
});
</script>

<template>
  <section
    class="auth-card"
    :class="{ 'finance-card': currentUser && showFinance }"
  >
    <FinanceDashboard
      v-if="currentUser && showFinance"
      :user="currentUser"
      @back="setView('home')"
      @logout="logout"
    />

    <ProfileForm
      v-else-if="currentUser && showProfile"
      :user="currentUser"
      @back="setView('home')"
      @updated="currentUser = $event"
    />

    <div v-else-if="currentUser" class="welcome">
      <div class="avatar">{{ currentUser.name.charAt(0).toUpperCase() }}</div>
      <p class="eyebrow">Вы вошли</p>
      <h2>Привет, {{ currentUser.name }}!</h2>
      <p class="muted">{{ currentUser.email }}</p>
      <span class="role-badge" :class="{ admin: currentUser.role === 'admin' }">
        {{ currentUser.role === 'admin' ? 'Администратор' : 'Пользователь' }}
      </span>

      <button
        class="primary-button finance-link"
        type="button"
        @click="setView('finance')"
      >
        Перейти к финансовому анализу
      </button>
      <button
        class="secondary-button"
        type="button"
        @click="setView('profile')"
      >
        Личный кабинет
      </button>
      <button class="secondary-button" type="button" @click="logout">
        Выйти
      </button>
    </div>

    <template v-else>
      <div class="tabs" role="tablist" aria-label="Авторизация">
        <button
          :class="{ active: mode === 'login' }"
          type="button"
          role="tab"
          :aria-selected="mode === 'login'"
          @click="selectMode('login')"
        >
          Вход
        </button>
        <button
          :class="{ active: mode === 'register' }"
          type="button"
          role="tab"
          :aria-selected="mode === 'register'"
          @click="selectMode('register')"
        >
          Регистрация
        </button>
      </div>

      <div class="form-heading">
        <p class="eyebrow">Добро пожаловать</p>
        <h2>
          {{
            mode === 'login'
              ? 'Войдите в аккаунт'
              : mode === 'register'
                ? 'Создайте аккаунт'
                : 'Восстановление пароля'
          }}
        </h2>
        <p class="muted">
          {{
            mode === 'login'
              ? 'Введите данные, указанные при регистрации.'
              : mode === 'register'
                ? 'Это займёт меньше минуты.'
                : 'Укажите email и новый пароль.'
          }}
        </p>
      </div>

      <form v-if="mode === 'reset-request'" @submit.prevent="requestReset">
        <label>
          Email
          <input
            v-model.trim="resetForm.email"
            type="email"
            autocomplete="email"
            placeholder="name@example.com"
            required
          />
        </label>

        <p v-if="error" class="message error" role="alert">{{ error }}</p>
        <p v-if="success" class="message success" role="status">
          {{ success }}
        </p>

        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? 'Подождите…' : 'Получить токен' }}
        </button>
        <button class="text-button" type="button" @click="selectMode('login')">
          Вернуться ко входу
        </button>
      </form>

      <form v-else-if="mode === 'reset-confirm'" @submit.prevent="confirmReset">
        <label>
          Токен
          <input
            v-model.trim="resetForm.token"
            autocomplete="one-time-code"
            minlength="20"
            required
          />
        </label>

        <label>
          Новый пароль
          <input
            v-model="resetForm.password"
            type="password"
            autocomplete="new-password"
            minlength="8"
            maxlength="72"
            placeholder="Минимум 8 символов"
            required
          />
        </label>

        <p v-if="error" class="message error" role="alert">{{ error }}</p>
        <p v-if="success" class="message success" role="status">
          {{ success }}
        </p>

        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? 'Подождите…' : 'Сменить пароль' }}
        </button>
        <button class="text-button" type="button" @click="selectMode('login')">
          Вернуться ко входу
        </button>
      </form>

      <form v-else @submit.prevent="submit">
        <label v-if="mode === 'register'">
          Имя
          <input
            v-model.trim="form.name"
            autocomplete="name"
            minlength="2"
            maxlength="50"
            placeholder="Алексей"
            required
          />
        </label>

        <label>
          Email
          <input
            v-model.trim="form.email"
            type="email"
            autocomplete="email"
            placeholder="name@example.com"
            required
          />
        </label>

        <label>
          Пароль
          <input
            v-model="form.password"
            type="password"
            :autocomplete="
              mode === 'login' ? 'current-password' : 'new-password'
            "
            minlength="8"
            maxlength="72"
            placeholder="Минимум 8 символов"
            required
          />
        </label>

        <p v-if="error" class="message error" role="alert">{{ error }}</p>
        <p v-if="success" class="message success" role="status">
          {{ success }}
        </p>

        <button class="primary-button" type="submit" :disabled="loading">
          {{
            loading
              ? 'Подождите…'
              : mode === 'login'
                ? 'Войти'
                : 'Зарегистрироваться'
          }}
        </button>
        <button
          v-if="mode === 'login'"
          class="text-button"
          type="button"
          @click="selectMode('reset-request')"
        >
          Забыли пароль?
        </button>
      </form>
    </template>
  </section>
</template>
