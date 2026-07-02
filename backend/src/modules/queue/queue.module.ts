import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { VideoProcessor } from './video.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'video-generation',
    }),
  ],
  providers: [QueueService, VideoProcessor],
  exports: [QueueService],
})
export class QueueModule {}
