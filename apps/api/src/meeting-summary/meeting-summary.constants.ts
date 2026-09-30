import { OPEN_ROUTER_FREE_MODEL } from '../open-router/open-router.constants';

/** Модель для генерации выжимки (по PRD — выбор модели пользователем вне скоупа). */
export const MEETING_SUMMARY_MODEL = OPEN_ROUTER_FREE_MODEL;

/** Структурированный JSON (summary + action items + решения) не помещается в дефолтные 1024 токена. */
export const MEETING_SUMMARY_MAX_TOKENS = 4096;
