export const OPEN_ROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Бесплатная модель для быстрых/тестовых запросов к OpenRouter (суффикс `:free` — не
 * списывает с баланса, но лимит 20 запросов/мин и 50 запросов/день, пока на аккаунт не
 * куплено 10+ кредитов — см. `apps/api/CLAUDE.md`).
 */
export const OPEN_ROUTER_FREE_MODEL = 'liquid/lfm-2.5-2.6b:free';
