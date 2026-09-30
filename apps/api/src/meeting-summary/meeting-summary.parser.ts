import { ActionItem, ParsedMeetingSummary } from './meeting-summary.types';

/** Извлекает JSON из ответа модели (допускает обёртку в ```json ... ```). */
function extractJsonText(rawResponse: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(rawResponse);
  return (fenced ? fenced[1] : rawResponse).trim();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseActionItem(rawItem: unknown): ActionItem {
  if (typeof rawItem !== 'object' || rawItem === null) {
    throw new Error('Action item должен быть объектом');
  }
  const { description, assignee } = rawItem as Record<string, unknown>;
  if (!isNonEmptyString(description)) {
    throw new Error('У action item нет описания');
  }
  if (assignee !== undefined && assignee !== null && typeof assignee !== 'string') {
    throw new Error('Ответственный должен быть строкой или null');
  }
  const normalizedAssignee = typeof assignee === 'string' ? assignee.trim() : '';
  return {
    description: description.trim(),
    assignee: normalizedAssignee.length > 0 ? normalizedAssignee : null,
  };
}

/** Бросает ошибку, если ответ модели не соответствует ожидаемой структуре — битые данные не сохраняются. */
export function parseMeetingSummaryResponse(rawResponse: string): ParsedMeetingSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(rawResponse));
  } catch {
    throw new Error('Ответ модели не является валидным JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Ответ модели должен быть JSON-объектом');
  }
  const { summary, actionItems, decisions } = parsed as Record<string, unknown>;

  if (!isNonEmptyString(summary)) {
    throw new Error('В ответе модели нет summary');
  }
  if (!Array.isArray(actionItems)) {
    throw new Error('actionItems должен быть массивом');
  }
  if (!Array.isArray(decisions) || !decisions.every(isNonEmptyString)) {
    throw new Error('decisions должен быть массивом непустых строк');
  }

  return {
    summary: summary.trim(),
    actionItems: actionItems.map(parseActionItem),
    decisions: decisions.map((decision) => decision.trim()),
  };
}
