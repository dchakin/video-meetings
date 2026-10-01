import { applyToolCall, createEmptyDraft, finalizeDraft } from './meeting-summary-agent.draft';
import { MeetingSummaryAgentTool } from './meeting-summary-agent.tools';

describe('meeting-summary-agent.draft', () => {
  it('записывает summary, задачи, решения и признак завершения', () => {
    const draft = createEmptyDraft();

    expect(
      applyToolCall(draft, MeetingSummaryAgentTool.SET_SUMMARY, '{"summary":" Итог "}'),
    ).toEqual({ ok: true });
    applyToolCall(
      draft,
      MeetingSummaryAgentTool.ADD_ACTION_ITEM,
      '{"description":"Сделать релиз","assignee":"Иван"}',
    );
    applyToolCall(draft, MeetingSummaryAgentTool.ADD_ACTION_ITEM, '{"description":"Доку"}');
    applyToolCall(draft, MeetingSummaryAgentTool.ADD_DECISION, '{"decision":"Релиз в пятницу"}');
    applyToolCall(draft, MeetingSummaryAgentTool.FINISH, '');

    expect(draft.isFinished).toBe(true);
    expect(finalizeDraft(draft)).toEqual({
      summary: 'Итог',
      actionItems: [
        { description: 'Сделать релиз', assignee: 'Иван' },
        { description: 'Доку', assignee: null },
      ],
      decisions: ['Релиз в пятницу'],
    });
  });

  it.each([
    [MeetingSummaryAgentTool.SET_SUMMARY, '{"summary":"  "}'],
    [MeetingSummaryAgentTool.ADD_ACTION_ITEM, '{"assignee":"Иван"}'],
    [MeetingSummaryAgentTool.ADD_ACTION_ITEM, '{"description":"x","assignee":5}'],
    [MeetingSummaryAgentTool.ADD_DECISION, '{}'],
    [MeetingSummaryAgentTool.SET_SUMMARY, 'не json'],
    ['unknown_tool', '{}'],
  ])('возвращает ошибку модели для %s с аргументами %s', (toolName, rawArguments) => {
    const draft = createEmptyDraft();

    const result = applyToolCall(draft, toolName, rawArguments);

    expect(result.ok).toBe(false);
    expect(draft).toEqual(createEmptyDraft());
  });

  it('finalizeDraft бросает ошибку без summary', () => {
    expect(() => finalizeDraft(createEmptyDraft())).toThrow('summary');
  });
});
