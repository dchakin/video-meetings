<!-- Декоративный фон для страниц аутентификации: мягкие синие блики + сетка. -->
<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div
      class="absolute -left-32 -top-32 size-[28rem] rounded-full bg-primary/25 blur-3xl dark:bg-primary/20"
    />
    <div
      class="absolute -bottom-40 -right-24 size-[32rem] rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/15"
    />
    <div
      class="absolute inset-0 opacity-[0.15] dark:opacity-10"
      style="
        background-image:
          linear-gradient(to right, rgb(148 163 184 / 0.4) 1px, transparent 1px),
          linear-gradient(to bottom, rgb(148 163 184 / 0.4) 1px, transparent 1px);
        background-size: 44px 44px;
        mask-image: radial-gradient(ellipse 60% 50% at 50% 40%, #000 40%, transparent 100%);
      "
    />
  </div>
</template>
