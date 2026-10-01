import {
  OPEN_ROUTER_FREE_TOOLS_FALLBACK_MODELS,
  OPEN_ROUTER_FREE_TOOLS_MODEL,
} from '../open-router/open-router.constants';

/** Модель агента выжимки (нужна поддержка tool calling; выбор модели пользователем вне скоупа). */
export const MEETING_SUMMARY_MODEL = OPEN_ROUTER_FREE_TOOLS_MODEL;

export const MEETING_SUMMARY_FALLBACK_MODELS = OPEN_ROUTER_FREE_TOOLS_FALLBACK_MODELS;

/** На один шаг агента — вызов инструмента(ов); лимит токенов на ответ шага. */
export const MEETING_SUMMARY_MAX_TOKENS = 2048;

/** Защита от бесконечного цикла агента: summary + задачи + решения + finish с запасом. */
export const MAX_AGENT_STEPS = 12;
