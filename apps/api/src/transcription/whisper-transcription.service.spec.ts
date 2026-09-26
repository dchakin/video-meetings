import { nodewhisper } from 'nodejs-whisper';
import { WHISPER_MODEL_NAME } from './transcription.constants';
import { WhisperTranscriptionService } from './whisper-transcription.service';

jest.mock('nodejs-whisper', () => ({
  nodewhisper: jest.fn(),
}));

describe('WhisperTranscriptionService', () => {
  let service: WhisperTranscriptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WhisperTranscriptionService();
  });

  describe('transcribeFile', () => {
    it('распознаёт mp3 и убирает временные метки whisper.cpp из результата', async () => {
      (nodewhisper as jest.Mock).mockResolvedValue(
        '[00:00:00.000 --> 00:00:02.000]   Привет,\n[00:00:02.000 --> 00:00:04.000]   мир!',
      );

      const result = await service.transcribeFile('/tmp/audio.mp3', 'audio/mpeg');

      expect(result).toBe('Привет,\nмир!');
      expect(nodewhisper).toHaveBeenCalledWith(
        '/tmp/audio.mp3',
        expect.objectContaining({ modelName: WHISPER_MODEL_NAME }),
      );
    });

    it('распознаёт mp4 (аудиодорожку извлекает сам nodejs-whisper через ffmpeg)', async () => {
      (nodewhisper as jest.Mock).mockResolvedValue('[00:00:00.000 --> 00:00:01.000]   Текст');

      const result = await service.transcribeFile('/tmp/video.mp4', 'video/mp4');

      expect(result).toBe('Текст');
      expect(nodewhisper).toHaveBeenCalledWith('/tmp/video.mp4', expect.any(Object));
    });

    it('отклоняет неподдерживаемый mimetype без вызова whisper', async () => {
      await expect(service.transcribeFile('/tmp/file.txt', 'text/plain')).rejects.toThrow(
        'text/plain',
      );
      expect(nodewhisper).not.toHaveBeenCalled();
    });

    it('пробрасывает ошибку whisper.cpp без подавления', async () => {
      (nodewhisper as jest.Mock).mockRejectedValue(new Error('whisper-cli завершился с ошибкой'));

      await expect(service.transcribeFile('/tmp/audio.mp3', 'audio/mpeg')).rejects.toThrow(
        'whisper-cli завершился с ошибкой',
      );
    });
  });
});
