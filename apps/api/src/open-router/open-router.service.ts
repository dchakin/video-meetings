import { Injectable } from '@nestjs/common';
import { getOpenRouterApiKeyOrThrow } from './open-router.config';
import { OPEN_ROUTER_CHAT_COMPLETIONS_URL } from './open-router.constants';
import { OpenRouterAssistantMessage, OpenRouterChatRequest } from './open-router.types';

type OpenRouterChatCompletionsResponse = {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: OpenRouterAssistantMessage['toolCalls'];
    };
  }[];
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
    const message = await this.postChatCompletion({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    });
    if (!message.content) {
      throw new Error('OpenRouter не вернул текст ответа');
    }

    return message.content;
  }

  /** Один шаг диалога с инструментами: возвращает ответ модели (текст и/или вызовы инструментов). */
  async chat(request: OpenRouterChatRequest): Promise<OpenRouterAssistantMessage> {
    const message = await this.postChatCompletion({
      model: request.model,
      ...(request.fallbackModels?.length && {
        models: [request.model, ...request.fallbackModels],
      }),
      messages: request.messages,
      tools: request.tools,
      tool_choice: 'auto',
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    });
    const toolCalls = message.tool_calls ?? [];
    if (!message.content && toolCalls.length === 0) {
      throw new Error('OpenRouter не вернул ни текст, ни вызовы инструментов');
    }

    return { content: message.content ?? null, toolCalls };
  }

  private async postChatCompletion(
    body: Record<string, unknown>,
  ): Promise<NonNullable<NonNullable<OpenRouterChatCompletionsResponse['choices']>[0]['message']>> {
    const apiKey = getOpenRouterApiKeyOrThrow();

    const response = await fetch(OPEN_ROUTER_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter вернул ошибку ${response.status}: ${errorBody}`);
    }

    const parsed = (await response.json()) as OpenRouterChatCompletionsResponse;
    const message = parsed.choices?.[0]?.message;
    if (!message) {
      throw new Error('OpenRouter не вернул ответ');
    }

    return message;
  }
}
