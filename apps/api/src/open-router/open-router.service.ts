import { Injectable } from '@nestjs/common';
import { getOpenRouterApiKeyOrThrow } from './open-router.config';
import { OPEN_ROUTER_CHAT_COMPLETIONS_URL } from './open-router.constants';

type OpenRouterChatCompletionsResponse = {
  choices?: { message?: { content?: string } }[];
};

/**
 * Без явного `max_tokens` OpenRouter резервирует под ответ максимум, который поддерживает
 * модель (десятки тысяч токенов), и при малом балансе ключа отклоняет запрос с 402 ещё до
 * генерации. Разумный дефолт для короткого текстового ответа.
 */
const DEFAULT_MAX_TOKENS = 1024;

/** HTTP-клиент к OpenRouter (OpenAI-совместимый `chat/completions`) — без SDK. */
@Injectable()
export class OpenRouterService {
  async ask(prompt: string, model: string, maxTokens = DEFAULT_MAX_TOKENS): Promise<string> {
    const apiKey = getOpenRouterApiKeyOrThrow();

    const response = await fetch(OPEN_ROUTER_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter вернул ошибку ${response.status}: ${errorBody}`);
    }

    const body = (await response.json()) as OpenRouterChatCompletionsResponse;
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenRouter не вернул текст ответа');
    }

    return content;
  }
}
