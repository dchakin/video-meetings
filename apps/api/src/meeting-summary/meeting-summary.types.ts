export type ActionItem = {
  description: string;
  /** Как назван во встрече; `null`, если исполнитель не назван. */
  assignee: string | null;
};

/** Валидная структура ответа модели. */
export type ParsedMeetingSummary = {
  summary: string;
  actionItems: ActionItem[];
  decisions: string[];
};
