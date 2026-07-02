import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { cancelledJobs } from './video.processor';

@Injectable()
export class QueueService {
  constructor(@InjectQueue('video-generation') private videoQueue: Queue) {}

  async addVideoJob(
    jobId: string,
    ideaId: string,
    subject: string,
    script: string | undefined,
    language: string,
    config: any,
  ) {
    return this.videoQueue.add(
      'generate-video',
      {
        jobId,
        ideaId,
        subject,
        script,
        language,
        config,
      },
      {
        jobId,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async getJobStatus(jobId: string) {
    const job = await this.videoQueue.getJob(jobId);
    if (!job) return null;
    return await job.getState();
  }

  async cancelJob(jobId: string) {
    cancelledJobs.add(jobId);
    const job = await this.videoQueue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  }
}
