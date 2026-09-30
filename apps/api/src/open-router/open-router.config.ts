// См. комментарий в `meeting-file/file-storage.config.ts`: `@nestjs/config` читает `.env`
// только при построении графа модулей Nest — гарантируем `process.env` из `.env` заранее.
import 'dotenv/config';

export function getOpenRouterApiKeyOrThrow(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY должен быть задан');
  }
  return apiKey;
}
