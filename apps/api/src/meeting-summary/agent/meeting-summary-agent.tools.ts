import { OpenRouterTool } from '../../open-router/open-router.types';

export enum MeetingSummaryAgentTool {
  SET_SUMMARY = 'set_summary',
  ADD_ACTION_ITEM = 'add_action_item',
  ADD_DECISION = 'add_decision',
  FINISH = 'finish',
}

export const MEETING_SUMMARY_AGENT_TOOLS: OpenRouterTool[] = [
  {
    type: 'function',
    function: {
      name: MeetingSummaryAgentTool.SET_SUMMARY,
      description: 'Записать краткую связную выжимку о содержании встречи. Вызвать один раз.',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string', description: 'Текст выжимки' } },
        required: ['summary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: MeetingSummaryAgentTool.ADD_ACTION_ITEM,
      description: 'Добавить задачу (action item), которую нужно выполнить по итогам встречи.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Что нужно сделать' },
          assignee: {
            type: ['string', 'null'],
            description: 'Ответственный в том виде, как он назван во встрече, или null',
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: MeetingSummaryAgentTool.ADD_DECISION,
      description: 'Добавить принятое на встрече решение.',
      parameters: {
        type: 'object',
        properties: { decision: { type: 'string', description: 'Текст решения' } },
        required: ['decision'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: MeetingSummaryAgentTool.FINISH,
      description: 'Завершить работу, когда выжимка, задачи и решения записаны.',
      parameters: { type: 'object', properties: {} },
    },
  },
];
