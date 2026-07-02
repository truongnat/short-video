import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { VideosService } from './videos.service';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  findAll() {
    return this.videosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videosService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.videosService.remove(id);
  }

  @Post(':id/regenerate')
  regenerate(@Param('id') id: string) {
    return this.videosService.regenerate(id);
  }

  @Get(':id/stream')
  async stream(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.videosService.getStream(id);
    if (file.contentType) {
      res.setHeader('Content-Type', file.contentType);
    }
    if (file.contentLength) {
      res.setHeader('Content-Length', String(file.contentLength));
    }
    return new StreamableFile(file.stream);
  }

  @Get(':id/thumbnail')
  async thumbnail(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.videosService.getThumbnail(id);
    if (file.contentType) {
      res.setHeader('Content-Type', file.contentType);
    }
    if (file.contentLength) {
      res.setHeader('Content-Length', String(file.contentLength));
    }
    return new StreamableFile(file.stream);
  }

  @Get(':id/subtitle')
  async subtitle(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.videosService.getSubtitle(id);
    if (file.contentType) {
      res.setHeader('Content-Type', file.contentType);
    }
    if (file.contentLength) {
      res.setHeader('Content-Length', String(file.contentLength));
    }
    return new StreamableFile(file.stream);
  }
}
