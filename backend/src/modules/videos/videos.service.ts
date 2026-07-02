import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class VideosService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private jobsService: JobsService,
  ) {}

  private async getVideoOrThrow(id: string, include?: Record<string, unknown>) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include,
    });

    if (!video) {
      throw new NotFoundException('Không tìm thấy video');
    }

    return video;
  }

  async findAll() {
    return this.prisma.video.findMany({
      select: {
        id: true,
        title: true,
        ratio: true,
        createdAt: true,
        thumbnailObjectKey: true,
        idea: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.getVideoOrThrow(id, {
      idea: true,
      job: true,
    });
  }

  async remove(id: string) {
    const video = await this.getVideoOrThrow(id);

    // Delete files from storage
    try {
      await this.storage.deleteFile(video.videoObjectKey);
      if (video.thumbnailObjectKey) {
        await this.storage.deleteFile(video.thumbnailObjectKey);
      }
      if (video.subtitleObjectKey) {
        await this.storage.deleteFile(video.subtitleObjectKey);
      }
      if (video.metadataObjectKey) {
        await this.storage.deleteFile(video.metadataObjectKey);
      }
    } catch (e) {
      // Log error but proceed to delete record from DB in case file doesn't exist
      console.error('Failed to delete files from MinIO:', e);
    }

    // Delete database record
    return this.prisma.video.delete({
      where: { id },
    });
  }

  async regenerate(id: string) {
    const video = await this.getVideoOrThrow(id);
    return this.jobsService.retry(video.jobId);
  }

  async getStream(id: string, range?: string) {
    const video = await this.getVideoOrThrow(id);
    return this.storage.getFileStream(video.videoObjectKey, range);
  }

  async getThumbnail(id: string) {
    const video = await this.getVideoOrThrow(id);
    if (!video.thumbnailObjectKey) {
      throw new NotFoundException('Không tìm thấy thumbnail');
    }
    return this.storage.getFileStream(video.thumbnailObjectKey);
  }

  async getSubtitle(id: string) {
    const video = await this.getVideoOrThrow(id);
    if (!video.subtitleObjectKey) {
      throw new NotFoundException('Không tìm thấy subtitle');
    }
    return this.storage.getFileStream(video.subtitleObjectKey);
  }
}
