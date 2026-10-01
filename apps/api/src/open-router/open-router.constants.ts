export const OPEN_ROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Бесплатная модель для быстрых/тестовых запросов к OpenRouter (суффикс `:free` — не
 * списывает с баланса, но лимит 20 запросов/мин и 50 запросов/день, пока на аккаунт не
 * куплено 10+ кредитов — см. `apps/api/CLAUDE.md`).
 */
export const OPEN_ROUTER_FREE_MODEL = 'liquid/lfm-2.5-2.6b:free';

/**
 * Бесплатная модель с поддержкой вызова инструментов (tool calling) — для агентов. Выбрана из
 * `GET https://openrouter.ai/api/v1/models?supported_parameters=tools` среди `:free`; крупнее
 * `OPEN_ROUTER_FREE_MODEL`, поэтому надёжнее следует схемам инструментов.
 */
export const OPEN_ROUTER_FREE_TOOLS_MODEL = 'qwen/qwen3.8-27b:free';

/** Резерв на случай 429 от апстрима общего бесплатного пула (бывает у любой `:free` модели). */
export const OPEN_ROUTER_FREE_TOOLS_FALLBACK_MODELS = [
  'google/gemma-4-31b-it:free',
  'liquid/lfm-2.5-2.6b:free',
];
