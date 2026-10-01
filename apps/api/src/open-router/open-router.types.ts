export type OpenRouterToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON-строка с аргументами — как её вернула модель. */ arguments: string;
  };
};

export type OpenRouterMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenRouterToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type OpenRouterTool = {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type OpenRouterChatRequest = {
  model: string;
  /** Резервные модели: OpenRouter переключается на них, если основная недоступна (429/5xx апстрима). */
  fallbackModels?: string[];
  messages: OpenRouterMessage[];
  tools: OpenRouterTool[];
  maxTokens?: number;
};

export type OpenRouterAssistantMessage = {
  content: string | null;
  toolCalls: OpenRouterToolCall[];
};
