import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async findAll() {
    return this.prisma.generationJob.findMany({
      include: {
        idea: {
          select: { title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const job = await this.prisma.generationJob.findUnique({
      where: { id },
      include: {
        idea: true,
        logs: {
          orderBy: { createdAt: 'asc' },
        },
        videos: true,
      },
    });
    if (!job) {
      throw new NotFoundException('Không tìm thấy job');
    }
    return job;
  }

  async getLogs(id: string) {
    await this.findOne(id);
    return this.prisma.jobLog.findMany({
      where: { jobId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  private readonly ACTIVE_STATUSES = [
    'queued',
    'running',
    'generating_script',
    'fetching_materials',
    'generating_voice',
    'generating_subtitle',
    'rendering',
    'uploading',
  ];

  async cancel(id: string) {
    const job = await this.findOne(id);
    if (!this.ACTIVE_STATUSES.includes(job.status)) {
      throw new BadRequestException(
        'Chỉ có thể hủy job đang chờ hoặc đang chạy',
      );
    }

    // Try to remove from BullMQ
    await this.queueService.cancelJob(id);

    // Update database
    return this.prisma.generationJob.update({
      where: { id },
      data: {
        status: 'cancelled',
        finishedAt: new Date(),
      },
    });
  }

  async retry(id: string) {
    const originalJob = await this.findOne(id);

    if (this.ACTIVE_STATUSES.includes(originalJob.status)) {
      throw new BadRequestException(
        'Không thể thử lại job đang chờ hoặc đang chạy',
      );
    }

    // Create a new job based on the original job config
    const newJob = await this.prisma.generationJob.create({
      data: {
        ideaId: originalJob.ideaId,
        status: 'queued',
        config: originalJob.config || {},
      },
    });

    // Add to BullMQ
    await this.queueService.addVideoJob(
      newJob.id,
      originalJob.ideaId,
      originalJob.idea.title,
      originalJob.idea.script || undefined,
      originalJob.idea.language,
      originalJob.config || {},
    );

    return newJob;
  }
}
