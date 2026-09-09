<script setup lang="ts">
const { isAuthenticated, logout } = useAuth();
</script>

<template>
  <UContainer class="py-16">
    <p class="text-xs font-medium uppercase tracking-[0.2em] text-primary">Video Meetings</p>
    <h1 class="mt-2 font-display text-3xl font-semibold tracking-tight text-highlighted">web</h1>
    <p class="mt-2 text-muted">Nuxt 4 + Nuxt UI приложение инициализировано.</p>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <template v-if="isAuthenticated">
        <UBadge color="primary" variant="subtle" size="lg" label="Вы вошли в систему" />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          label="Выйти"
          @click="logout"
        />
      </template>
      <template v-else>
        <UButton to="/register" icon="i-lucide-user-plus" label="Регистрация" />
        <UButton to="/login" color="neutral" variant="subtle" label="Войти" />
      </template>
    </div>
  </UContainer>
</template>
