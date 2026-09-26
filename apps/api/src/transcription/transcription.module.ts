import { Module } from '@nestjs/common';
import { WhisperTranscriptionService } from './whisper-transcription.service';

@Module({
  providers: [WhisperTranscriptionService],
  exports: [WhisperTranscriptionService],
})
export class TranscriptionModule {}
