<script setup lang="ts">
import type { FetchError } from 'ofetch';
import type { FormError, FormSubmitEvent } from '@nuxt/ui';

definePageMeta({ middleware: 'auth' });

useHead({ title: 'Мои встречи' });

const { user, logout } = useAuth();
const { list, create } = useMeetings();
const toast = useToast();

const {
  data: meetings,
  pending,
  error,
  refresh,
} = await useAsyncData('meetings', () => list(), { default: () => [] });

// API отдаёт встречи по убыванию `createdAt` — первые три и есть последние созданные.
const recent = computed(() => meetings.value.slice(0, 3));

async function onLogout() {
  logout();
  await navigateTo('/login');
}

// --- Создание встречи ---------------------------------------------------------

interface CreateState {
  title: string;
  date: string;
  participants: string;
}

const createOpen = ref(false);
const creating = ref(false);
const state = reactive<CreateState>({ title: '', date: '', participants: '' });

function resetForm() {
  state.title = '';
  state.date = '';
  state.participants = '';
}

function validate(s: CreateState): FormError[] {
  const errors: FormError[] = [];
  if (!s.title.trim()) errors.push({ name: 'title', message: 'Укажите название' });
  if (!s.date) errors.push({ name: 'date', message: 'Укажите дату и время' });
  return errors;
}

async function onCreate(event: FormSubmitEvent<CreateState>) {
  creating.value = true;
  try {
    await create({
      title: event.data.title.trim(),
      date: new Date(event.data.date).toISOString(),
      participants: event.data.participants
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
    });
    toast.add({ title: 'Встреча создана', color: 'success', icon: 'i-lucide-check' });
    createOpen.value = false;
    resetForm();
    await refresh();
  } catch (err) {
    const message = (err as FetchError<{ message?: string | string[] }>).data?.message;
    toast.add({
      title: 'Не удалось создать встречу',
      description: Array.isArray(message) ? message.join(', ') : message,
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.2em] text-primary">Video Meetings</p>
        <h1 class="mt-2 font-display text-3xl font-semibold tracking-tight text-highlighted">
          Мои встречи
        </h1>
        <p class="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-user" class="size-4" />
          <span>Вы вошли как {{ user?.email }}</span>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton icon="i-lucide-plus" label="Создать встречу" @click="createOpen = true" />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          label="Выйти"
          @click="onLogout"
        />
      </div>
    </header>

    <UAlert
      v-if="error"
      class="mt-10"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Не удалось загрузить встречи"
      description="Проверьте, что API доступен, и попробуйте обновить страницу."
      :actions="[
        { label: 'Повторить', color: 'error', variant: 'outline', onClick: () => refresh() },
      ]"
    />

    <template v-else>
      <section v-if="recent.length" class="mt-10">
        <h2 class="font-display text-lg font-semibold text-highlighted">Последние встречи</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MeetingCard v-for="meeting in recent" :key="meeting.id" :meeting="meeting" />
        </div>
      </section>

      <section class="mt-12">
        <div class="flex items-center gap-2">
          <h2 class="font-display text-lg font-semibold text-highlighted">Все встречи</h2>
          <UBadge
            v-if="meetings.length"
            color="neutral"
            variant="subtle"
            :label="meetings.length"
          />
        </div>

        <div v-if="pending" class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <USkeleton v-for="i in 3" :key="i" class="h-28 rounded-xl" />
        </div>

        <div
          v-else-if="!meetings.length"
          class="mt-4 flex flex-col items-center rounded-xl border border-dashed border-default px-6 py-14 text-center"
        >
          <div class="flex size-12 items-center justify-center rounded-full bg-elevated text-muted">
            <UIcon name="i-lucide-calendar-plus" class="size-6" />
          </div>
          <p class="mt-4 font-medium text-highlighted">Встреч пока нет</p>
          <p class="mt-1 text-sm text-muted">Создайте первую встречу, чтобы она появилась здесь.</p>
          <UButton
            class="mt-5"
            icon="i-lucide-plus"
            label="Создать встречу"
            @click="createOpen = true"
          />
        </div>

        <div v-else class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MeetingCard v-for="meeting in meetings" :key="meeting.id" :meeting="meeting" />
        </div>
      </section>
    </template>

    <UModal v-model:open="createOpen" title="Новая встреча" :ui="{ footer: 'justify-end' }">
      <template #body>
        <UForm
          id="create-meeting"
          :state="state"
          :validate="validate"
          class="space-y-5"
          @submit="onCreate"
        >
          <UFormField name="title" label="Название" required>
            <UInput
              v-model="state.title"
              placeholder="Синхронизация команды"
              size="lg"
              class="w-full"
              autofocus
            />
          </UFormField>

          <UFormField name="date" label="Дата и время" required>
            <UInput v-model="state.date" type="datetime-local" size="lg" class="w-full" />
          </UFormField>

          <UFormField
            name="participants"
            label="Участники"
            hint="через запятую"
            help="Например: anna@example.com, ivan@example.com"
          >
            <UInput
              v-model="state.participants"
              placeholder="anna@example.com, ivan@example.com"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </UForm>
      </template>

      <template #footer="{ close }">
        <UButton label="Отмена" color="neutral" variant="outline" @click="close" />
        <UButton type="submit" form="create-meeting" label="Создать" :loading="creating" />
      </template>
    </UModal>
  </UContainer>
</template>
