import { OpenRouterService } from '../../open-router/open-router.service';
import { MAX_AGENT_STEPS } from '../meeting-summary.constants';
import { MeetingSummaryAgentService } from './meeting-summary-agent.service';
import { MeetingSummaryAgentTool } from './meeting-summary-agent.tools';

function toolCall(id: string, name: MeetingSummaryAgentTool, args: object = {}) {
  return { id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } };
}

describe('MeetingSummaryAgentService', () => {
  let openRouter: { chat: jest.Mock };
  let service: MeetingSummaryAgentService;

  beforeEach(() => {
    openRouter = { chat: jest.fn() };
    service = new MeetingSummaryAgentService(openRouter as unknown as OpenRouterService);
  });

  it('собирает результат из вызовов инструментов до finish', async () => {
    openRouter.chat
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          toolCall('1', MeetingSummaryAgentTool.SET_SUMMARY, { summary: 'Итог' }),
          toolCall('2', MeetingSummaryAgentTool.ADD_ACTION_ITEM, {
            description: 'Сделать',
            assignee: 'Иван',
          }),
        ],
      })
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          toolCall('3', MeetingSummaryAgentTool.ADD_DECISION, { decision: 'Да' }),
          toolCall('4', MeetingSummaryAgentTool.FINISH),
        ],
      });

    await expect(service.run(['Текст встречи'])).resolves.toEqual({
      summary: 'Итог',
      actionItems: [{ description: 'Сделать', assignee: 'Иван' }],
      decisions: ['Да'],
    });
    const [firstRequest] = openRouter.chat.mock.calls[0] as [{ messages: { content: string }[] }];
    expect(firstRequest.messages[1].content).toContain('Текст встречи');
  });

  it('возвращает модели ошибку валидации, и она может исправиться', async () => {
    openRouter.chat
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [toolCall('1', MeetingSummaryAgentTool.SET_SUMMARY, { summary: '' })],
      })
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          toolCall('2', MeetingSummaryAgentTool.SET_SUMMARY, { summary: 'Итог' }),
          toolCall('3', MeetingSummaryAgentTool.FINISH),
        ],
      });

    await expect(service.run(['Текст'])).resolves.toEqual(
      expect.objectContaining({ summary: 'Итог' }),
    );
    const [secondRequest] = openRouter.chat.mock.calls[1] as [
      { messages: { role: string; content: string }[] },
    ];
    expect(secondRequest.messages.find((message) => message.role === 'tool')?.content).toContain(
      'Ошибка',
    );
  });

  it('бросает ошибку, если агент ответил без вызова инструментов и без finish', async () => {
    openRouter.chat.mockResolvedValue({ content: 'Просто текст', toolCalls: [] });

    await expect(service.run(['Текст'])).rejects.toThrow('не завершил');
  });

  it('бросает ошибку при завершении без summary', async () => {
    openRouter.chat.mockResolvedValue({
      content: null,
      toolCalls: [toolCall('1', MeetingSummaryAgentTool.FINISH)],
    });

    await expect(service.run(['Текст'])).rejects.toThrow('summary');
  });

  it('останавливается по лимиту шагов', async () => {
    openRouter.chat.mockResolvedValue({
      content: null,
      toolCalls: [toolCall('1', MeetingSummaryAgentTool.ADD_DECISION, { decision: 'Ещё' })],
    });

    await expect(service.run(['Текст'])).rejects.toThrow('не завершил');
    expect(openRouter.chat).toHaveBeenCalledTimes(MAX_AGENT_STEPS);
  });
});
