/** Транскрибация файла встречи завершена (успешно или с ошибкой). */
export class TranscriptionFinishedEvent {
  constructor(public readonly meetingId: string) {}
}
