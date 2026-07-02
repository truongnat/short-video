import { Controller, Get, Post, Param } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  findAll() {
    return this.jobsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Get(':id/logs')
  getLogs(@Param('id') id: string) {
    return this.jobsService.getLogs(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.jobsService.cancel(id);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.jobsService.retry(id);
  }
}
