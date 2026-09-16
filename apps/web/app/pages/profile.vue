<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

useHead({ title: 'Профиль' });

const { profile, load } = useProfile();

const { pending, error, refresh } = await useAsyncData('profile', () => load());

/** Имя может быть не заполнено — тогда показываем локальную часть email. */
const displayName = computed(() => profile.value?.name || profile.value?.email.split('@')[0] || '');
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <UButton
      to="/"
      icon="i-lucide-arrow-left"
      label="Мои встречи"
      color="neutral"
      variant="link"
      class="px-0"
    />

    <UAlert
      v-if="error"
      class="mt-6"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Не удалось загрузить профиль"
      description="Проверьте, что API доступен, и попробуйте обновить страницу."
      :actions="[
        { label: 'Повторить', color: 'error', variant: 'outline', onClick: () => refresh() },
      ]"
    />

    <template v-else>
      <h1 class="mt-6 font-display text-3xl font-semibold tracking-tight text-highlighted">
        Профиль
      </h1>

      <UCard class="mt-6">
        <div v-if="pending" class="flex items-center gap-4">
          <USkeleton class="size-16 rounded-full" />
          <div class="space-y-2">
            <USkeleton class="h-5 w-40" />
            <USkeleton class="h-4 w-56" />
          </div>
        </div>

        <div v-else class="flex items-center gap-4">
          <UAvatar
            :src="profile?.avatarUrl ?? undefined"
            :alt="displayName"
            icon="i-lucide-user"
            size="xl"
          />
          <div>
            <p class="font-display text-lg font-semibold text-highlighted">{{ displayName }}</p>
            <p class="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <UIcon name="i-lucide-mail" class="size-4" />
              <span>{{ profile?.email }}</span>
            </p>
          </div>
        </div>
      </UCard>
    </template>
  </UContainer>
</template>
