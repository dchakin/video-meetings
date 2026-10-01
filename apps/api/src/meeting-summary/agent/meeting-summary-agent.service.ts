import { Injectable } from '@nestjs/common';
import { OpenRouterService } from '../../open-router/open-router.service';
import { OpenRouterMessage } from '../../open-router/open-router.types';
import {
  MAX_AGENT_STEPS,
  MEETING_SUMMARY_FALLBACK_MODELS,
  MEETING_SUMMARY_MAX_TOKENS,
  MEETING_SUMMARY_MODEL,
} from '../meeting-summary.constants';
import { ParsedMeetingSummary } from '../meeting-summary.types';
import {
  applyToolCall,
  createEmptyDraft,
  finalizeDraft,
  MeetingSummaryDraft,
} from './meeting-summary-agent.draft';
import { buildAgentSystemPrompt, buildAgentUserMessage } from './meeting-summary-agent.prompt';
import { MEETING_SUMMARY_AGENT_TOOLS } from './meeting-summary-agent.tools';

/** Tool-calling агент: через инструменты заполняет выжимку, задачи и решения встречи. */
@Injectable()
export class MeetingSummaryAgentService {
  constructor(private readonly openRouter: OpenRouterService) {}

  async run(transcriptions: string[]): Promise<ParsedMeetingSummary> {
    const draft = createEmptyDraft();
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: buildAgentSystemPrompt() },
      { role: 'user', content: buildAgentUserMessage(transcriptions) },
    ];

    for (let step = 0; step < MAX_AGENT_STEPS && !draft.isFinished; step++) {
      const reply = await this.openRouter.chat({
        model: MEETING_SUMMARY_MODEL,
        fallbackModels: MEETING_SUMMARY_FALLBACK_MODELS,
        messages,
        tools: MEETING_SUMMARY_AGENT_TOOLS,
        maxTokens: MEETING_SUMMARY_MAX_TOKENS,
      });
      if (reply.toolCalls.length === 0) {
        break;
      }

      messages.push({ role: 'assistant', content: reply.content, tool_calls: reply.toolCalls });
      this.applyToolCalls(draft, reply.toolCalls, messages);
    }

    if (!draft.isFinished) {
      throw new Error('Агент не завершил работу (finish) за отведённое число шагов');
    }
    return finalizeDraft(draft);
  }

  private applyToolCalls(
    draft: MeetingSummaryDraft,
    toolCalls: { id: string; function: { name: string; arguments: string } }[],
    messages: OpenRouterMessage[],
  ): void {
    for (const toolCall of toolCalls) {
      const result = applyToolCall(draft, toolCall.function.name, toolCall.function.arguments);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result.ok ? 'ok' : `Ошибка: ${result.error}`,
      });
    }
  }
}
