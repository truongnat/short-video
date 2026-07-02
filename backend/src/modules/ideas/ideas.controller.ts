import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { IdeasService } from './ideas.service';

@Controller('ideas')
export class IdeasController {
  constructor(private readonly ideasService: IdeasService) {}

  @Post()
  create(
    @Body()
    dto: {
      title: string;
      topic: string;
      description?: string;
      language?: string;
      tags?: string[];
      autoGenerateScript?: boolean;
    },
  ) {
    return this.ideasService.create(dto);
  }

  @Post('brainstorm')
  brainstorm(
    @Body()
    dto: {
      topic: string;
      language: string;
      existingTitles?: string[];
    },
  ) {
    return this.ideasService.brainstorm(dto);
  }

  @Post('batch-generate-video')
  batchGenerateVideo(
    @Body()
    dto: {
      topic: string;
      config: any;
    },
  ) {
    return this.ideasService.batchGenerateVideo(dto.topic, dto.config);
  }

  @Get()
  findAll() {
    return this.ideasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ideasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      title?: string;
      topic?: string;
      description?: string;
      script?: string;
      language?: string;
      tags?: string[];
      status?: string;
    },
  ) {
    return this.ideasService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ideasService.remove(id);
  }

  @Post(':id/generate-more')
  generateMore(@Param('id') id: string) {
    return this.ideasService.generateMore(id);
  }

  @Post(':id/generate-script')
  async generateScript(@Param('id') id: string) {
    const script = await this.ideasService.generateScript(id);
    if (!script) {
      throw new NotFoundException('Không thể tạo kịch bản: ý tưởng đã có kịch bản hoặc đang trong quá trình tạo');
    }
    return { script };
  }

  @Post(':id/generate-video')
  generateVideo(@Param('id') id: string, @Body() config: any) {
    return this.ideasService.generateVideo(id, config);
  }
}
