import { ActionItem, ParsedMeetingSummary } from '../meeting-summary.types';
import { MeetingSummaryAgentTool } from './meeting-summary-agent.tools';

/** Черновик результата агента: копится в памяти и сохраняется в БД только целиком. */
export type MeetingSummaryDraft = {
  summary: string | null;
  actionItems: ActionItem[];
  decisions: string[];
  isFinished: boolean;
};

export type ToolCallResult = { ok: true } | { ok: false; error: string };

export function createEmptyDraft(): MeetingSummaryDraft {
  return { summary: null, actionItems: [], decisions: [], isFinished: false };
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseArguments(rawArguments: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(rawArguments || '{}');
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Применяет вызов инструмента к черновику; ошибка валидации возвращается модели, чтобы она могла исправиться. */
export function applyToolCall(
  draft: MeetingSummaryDraft,
  toolName: string,
  rawArguments: string,
): ToolCallResult {
  const args = parseArguments(rawArguments);
  if (!args) {
    return { ok: false, error: 'Аргументы должны быть валидным JSON-объектом' };
  }

  switch (toolName) {
    case MeetingSummaryAgentTool.SET_SUMMARY: {
      const summary = asNonEmptyString(args.summary);
      if (!summary) return { ok: false, error: 'summary должен быть непустой строкой' };
      draft.summary = summary;
      return { ok: true };
    }
    case MeetingSummaryAgentTool.ADD_ACTION_ITEM: {
      const description = asNonEmptyString(args.description);
      if (!description) return { ok: false, error: 'description должен быть непустой строкой' };
      if (args.assignee != null && typeof args.assignee !== 'string') {
        return { ok: false, error: 'assignee должен быть строкой или null' };
      }
      draft.actionItems.push({ description, assignee: asNonEmptyString(args.assignee) });
      return { ok: true };
    }
    case MeetingSummaryAgentTool.ADD_DECISION: {
      const decision = asNonEmptyString(args.decision);
      if (!decision) return { ok: false, error: 'decision должен быть непустой строкой' };
      draft.decisions.push(decision);
      return { ok: true };
    }
    case MeetingSummaryAgentTool.FINISH:
      draft.isFinished = true;
      return { ok: true };
    default:
      return { ok: false, error: `Неизвестный инструмент ${toolName}` };
  }
}

/** Бросает ошибку, если агент не записал summary — частичные данные не сохраняются. */
export function finalizeDraft(draft: MeetingSummaryDraft): ParsedMeetingSummary {
  if (!draft.summary) {
    throw new Error('Агент не записал summary');
  }
  return {
    summary: draft.summary,
    actionItems: draft.actionItems,
    decisions: draft.decisions,
  };
}
