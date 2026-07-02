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

  async findAll() {
    const videos = await this.prisma.video.findMany({
      include: {
        idea: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Generate signed URLs for all videos
    return Promise.all(
      videos.map(async (v) => {
        const videoUrl = await this.storage.getDownloadUrl(v.videoObjectKey);
        const thumbnailUrl = v.thumbnailObjectKey
          ? await this.storage.getDownloadUrl(v.thumbnailObjectKey)
          : null;
        const subtitleUrl = v.subtitleObjectKey
          ? await this.storage.getDownloadUrl(v.subtitleObjectKey)
          : null;

        return {
          ...v,
          videoUrl,
          thumbnailUrl,
          subtitleUrl,
        };
      }),
    );
  }

  async findOne(id: string) {
    const v = await this.prisma.video.findUnique({
      where: { id },
      include: {
        idea: true,
        job: true,
      },
    });
    if (!v) {
      throw new NotFoundException('Không tìm thấy video');
    }

    const videoUrl = await this.storage.getDownloadUrl(v.videoObjectKey);
    const thumbnailUrl = v.thumbnailObjectKey
      ? await this.storage.getDownloadUrl(v.thumbnailObjectKey)
      : null;
    const subtitleUrl = v.subtitleObjectKey
      ? await this.storage.getDownloadUrl(v.subtitleObjectKey)
      : null;

    return {
      ...v,
      videoUrl,
      thumbnailUrl,
      subtitleUrl,
    };
  }

  async remove(id: string) {
    const video = await this.findOne(id);
    
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
    const video = await this.findOne(id);
    return this.jobsService.retry(video.jobId);
  }

  async getStream(id: string) {
    const video = await this.findOne(id);
    return this.storage.getFileStream(video.videoObjectKey);
  }

  async getThumbnail(id: string) {
    const video = await this.findOne(id);
    if (!video.thumbnailObjectKey) {
      throw new NotFoundException('Không tìm thấy thumbnail');
    }
    return this.storage.getFileStream(video.thumbnailObjectKey);
  }

  async getSubtitle(id: string) {
    const video = await this.findOne(id);
    if (!video.subtitleObjectKey) {
      throw new NotFoundException('Không tìm thấy subtitle');
    }
    return this.storage.getFileStream(video.subtitleObjectKey);
  }
}
