import { parseMeetingSummaryResponse } from './meeting-summary.parser';

describe('parseMeetingSummaryResponse', () => {
  const valid = {
    summary: 'S',
    actionItems: [{ description: 'D', assignee: ' Bob ' }],
    decisions: ['X'],
  };

  it('parses a plain JSON response and normalizes the assignee', () => {
    expect(parseMeetingSummaryResponse(JSON.stringify(valid))).toEqual({
      summary: 'S',
      actionItems: [{ description: 'D', assignee: 'Bob' }],
      decisions: ['X'],
    });
  });

  it('parses JSON wrapped into a markdown fence and treats missing assignee as null', () => {
    const raw =
      '```json\n' + JSON.stringify({ ...valid, actionItems: [{ description: 'D' }] }) + '\n```';
    expect(parseMeetingSummaryResponse(raw).actionItems).toEqual([
      { description: 'D', assignee: null },
    ]);
  });

  it.each([
    ['not json', 'hello'],
    ['no summary', JSON.stringify({ ...valid, summary: '' })],
    ['actionItems not array', JSON.stringify({ ...valid, actionItems: 'x' })],
    [
      'action item without description',
      JSON.stringify({ ...valid, actionItems: [{ assignee: 'A' }] }),
    ],
    ['decisions not strings', JSON.stringify({ ...valid, decisions: [1] })],
  ])('rejects an invalid response: %s', (_name, raw) => {
    expect(() => parseMeetingSummaryResponse(raw)).toThrow();
  });
});
