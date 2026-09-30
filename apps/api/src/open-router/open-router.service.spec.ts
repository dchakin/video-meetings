import 'dotenv/config';
import { OPEN_ROUTER_FREE_MODEL } from './open-router.constants';
import { OpenRouterService } from './open-router.service';

const OPEN_ROUTER_TIMEOUT_MS = 30_000;

// Реальный вызов OpenRouter (бесплатная модель, но с лимитом запросов/день) — пропускаем,
// если OPENROUTER_API_KEY не задан в окружении (например, в CI без секрета).
const describeIfApiKey = process.env.OPENROUTER_API_KEY ? describe : describe.skip;

describeIfApiKey('OpenRouterService', () => {
  it(
    'получает текстовый ответ от OpenRouter (бесплатная модель)',
    async () => {
      const service = new OpenRouterService();

      const result = await service.ask('Ответь ровно одним словом: OK', OPEN_ROUTER_FREE_MODEL);

      expect(typeof result).toBe('string');
      expect(result.trim().length).toBeGreaterThan(0);
    },
    OPEN_ROUTER_TIMEOUT_MS,
  );
});
