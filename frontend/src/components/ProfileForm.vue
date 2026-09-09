<script setup lang="ts">
import { reactive, ref } from 'vue';
import { authApi, type User } from '../api/auth';

const props = defineProps<{ user: User }>();
const emit = defineEmits<{ back: []; updated: [user: User] }>();

const form = reactive({
  name: props.user.name,
  lastName: props.user.lastName ?? '',
});
const loading = ref(false);
const error = ref('');
const success = ref('');

async function save() {
  loading.value = true;
  error.value = '';
  success.value = '';
  try {
    const user = await authApi.updateProfile(form);
    emit('updated', user);
    success.value = 'Данные профиля сохранены';
  } catch (requestError) {
    error.value =
      requestError instanceof Error
        ? requestError.message
        : 'Не удалось сохранить профиль';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="profile-page">
    <button
      class="text-button profile-back"
      type="button"
      @click="emit('back')"
    >
      ← Назад
    </button>
    <div class="avatar">{{ form.name.charAt(0).toUpperCase() }}</div>
    <p class="eyebrow">Личный кабинет</p>
    <h2>Персональные данные</h2>
    <p class="muted profile-email">{{ user.email }}</p>

    <form class="profile-form" @submit.prevent="save">
      <label>
        Имя
        <input
          v-model.trim="form.name"
          minlength="2"
          maxlength="50"
          autocomplete="given-name"
          required
        />
      </label>
      <label>
        Фамилия
        <input
          v-model.trim="form.lastName"
          minlength="2"
          maxlength="50"
          autocomplete="family-name"
          required
        />
      </label>
      <p v-if="error" class="message error" role="alert">{{ error }}</p>
      <p v-if="success" class="message success" role="status">{{ success }}</p>
      <button class="primary-button" type="submit" :disabled="loading">
        {{ loading ? 'Сохраняем…' : 'Сохранить изменения' }}
      </button>
    </form>
  </div>
</template>
