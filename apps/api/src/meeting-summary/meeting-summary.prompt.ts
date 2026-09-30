/** Промпт для выжимки: только транскрипции в статусе DONE, строго JSON, язык ответа — язык транскрипции. */
export function buildMeetingSummaryPrompt(transcriptions: string[]): string {
  const transcriptionsBlock = transcriptions
    .map((text, index) => `--- Транскрипция ${index + 1} ---\n${text}`)
    .join('\n\n');

  return [
    'Ты анализируешь транскрипции встречи и готовишь выжимку.',
    'Верни ТОЛЬКО валидный JSON без пояснений и markdown-обёртки строго такой структуры:',
    '{"summary": string, "actionItems": [{"description": string, "assignee": string | null}], "decisions": [string]}',
    'Правила:',
    '- summary — краткий связный текст о содержании встречи.',
    '- actionItems — задачи, которые нужно выполнить; assignee — ответственный в том виде, как он назван во встрече, или null, если исполнитель не назван.',
    '- decisions — принятые решения; если решений или задач не было, верни пустой массив.',
    '- Пиши выжимку на том же языке, на котором написаны транскрипции.',
    '',
    transcriptionsBlock,
  ].join('\n');
}
