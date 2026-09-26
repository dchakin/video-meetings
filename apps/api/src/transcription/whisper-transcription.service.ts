import { Injectable, Logger } from '@nestjs/common';
import { nodewhisper } from 'nodejs-whisper';
import {
  TRANSCRIBABLE_MEETING_FILE_MIME_TYPES,
  WHISPER_MODEL_NAME,
} from './transcription.constants';

/** Убирает временные метки whisper.cpp (`[00:00:00.000 --> 00:00:02.000]`) из строки транскрипта. */
const WHISPER_TIMESTAMP_PREFIX =
  /^\s*\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/;

/**
 * Интеграция с локальной моделью Whisper (whisper.cpp через `nodejs-whisper`, без обращения к
 * внешним API — см. PRD).
 */
@Injectable()
export class WhisperTranscriptionService {
  private readonly logger = new Logger(WhisperTranscriptionService.name);

  /**
   * Распознаёт речь в аудио/видео файле и возвращает текст транскрипции.
   *
   * Извлечение аудиодорожки из `video/mp4` отдельным шагом не делается: `nodejs-whisper` сам
   * прогоняет входной файл через ffmpeg (`-ar 16000 -ac 1`) перед распознаванием — команда
   * одинакова что для mp4, что для mp3, и дублировать её здесь незачем.
   *
   * Бросает ошибку при сбое (whisper.cpp недоступен, ffmpeg недоступен, файл повреждён и т.п.) —
   * без внутреннего подавления: перевод статуса файла в ERROR — забота вызывающего кода.
   */
  async transcribeFile(filePath: string, mimeType: string): Promise<string> {
    if (!TRANSCRIBABLE_MEETING_FILE_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Транскрибация не поддерживается для типа файла "${mimeType}"`);
    }

    const rawTranscript = await nodewhisper(filePath, {
      modelName: WHISPER_MODEL_NAME,
      autoDownloadModelName: WHISPER_MODEL_NAME,
      removeWavFileAfterTranscription: true,
      logger: {
        log: () => undefined,
        debug: () => undefined,
        error: (...args: unknown[]) => this.logger.error(args.join(' ')),
      },
      whisperOptions: {
        outputInText: true,
        wordTimestamps: false,
      },
    });

    return this.stripTimestamps(rawTranscript);
  }

  /** whisper.cpp по умолчанию печатает транскрипт построчно с временными метками — убираем их. */
  private stripTimestamps(rawTranscript: string): string {
    return rawTranscript
      .split('\n')
      .map((line) => line.replace(WHISPER_TIMESTAMP_PREFIX, ''))
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')
      .trim();
  }
}
