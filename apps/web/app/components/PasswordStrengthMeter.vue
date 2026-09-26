<script setup lang="ts">
const props = defineProps<{ password: string }>();

// Индикатор надёжности пароля: 0 — пусто, 1 — слабый … 4 — надёжный.
const strength = computed(() => {
  const value = props.password;
  if (!value) return 0;

  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/\d/.test(value) && /[a-zA-Zа-яА-ЯёЁ]/.test(value)) score++;
  if (/[^\w\s]/.test(value) || (/[a-zа-яё]/.test(value) && /[A-ZА-ЯЁ]/.test(value))) score++;

  return Math.min(score, 4);
});

const meta = computed(() => {
  return (
    [
      { label: 'Слабый', color: 'bg-error' },
      { label: 'Слабый', color: 'bg-error' },
      { label: 'Средний', color: 'bg-warning' },
      { label: 'Хороший', color: 'bg-warning' },
      { label: 'Надёжный', color: 'bg-success' },
    ][strength.value] ?? { label: 'Слабый', color: 'bg-error' }
  );
});
</script>

<template>
  <span v-if="strength > 0" class="flex flex-col gap-1.5">
    <span class="flex gap-1" aria-hidden="true">
      <span
        v-for="i in 4"
        :key="i"
        class="h-1 flex-1 rounded-full transition-colors"
        :class="i <= strength ? meta.color : 'bg-accented'"
      />
    </span>
    <span role="status" aria-live="polite">Надёжность пароля: {{ meta.label }}</span>
  </span>
</template>
