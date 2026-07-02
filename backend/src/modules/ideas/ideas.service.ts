import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';
import { QueueService } from '../queue/queue.service';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class IdeasService {
  private readonly logger = new Logger(IdeasService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private queueService: QueueService,
  ) {}

  async create(dto: {
    title: string;
    topic: string;
    description?: string;
    language?: string;
    tags?: string[];
    autoGenerateScript?: boolean;
  }) {
    const { autoGenerateScript, ...data } = dto;
    const idea = await this.prisma.idea.create({
      data: {
        title: data.title,
        topic: data.topic,
        description: data.description,
        language: data.language || 'vi',
        tags: data.tags || [],
        status: 'draft',
      },
    });

    if (autoGenerateScript) {
      this.generateScript(idea.id).catch((err) => {
        this.logger.error(`Failed to auto-generate script for idea ${idea.id}: ${err.message}`);
      });
    }

    return idea;
  }

  async findAll() {
    return this.prisma.idea.findMany({
      include: {
        jobs: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id },
      include: {
        jobs: {
          orderBy: { createdAt: 'desc' },
        },
        videos: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!idea) {
      throw new NotFoundException('Không tìm thấy ý tưởng');
    }
    return idea;
  }

  async update(id: string, dto: { title?: string; topic?: string; description?: string; script?: string; language?: string; tags?: string[]; status?: string }) {
    await this.findOne(id);
    return this.prisma.idea.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.idea.delete({
      where: { id },
    });
  }

  async brainstorm(dto: { topic: string; language: string }): Promise<any[]> {
    const generated = await this.llm.generateIdeas(dto.topic, dto.language);
    const createdIdeas = [];
    for (const item of generated) {
      const created = await this.prisma.idea.create({
        data: {
          title: item.title,
          topic: dto.topic,
          description: item.description,
          language: dto.language,
          status: 'draft',
        },
      });
      createdIdeas.push(created);
    }

    // Trigger script generation in the background for all brainstormed ideas!
    for (const idea of createdIdeas) {
      this.generateScript(idea.id).catch((err) => {
        this.logger.error(`Failed to auto-generate script for brainstormed idea ${idea.id}: ${err.message}`);
      });
    }

    return createdIdeas;
  }

  async generateMore(id: string) {
    const idea = await this.findOne(id);
    const generated = await this.llm.generateIdeas(idea.topic, idea.language);
    
    // Save generated ideas to database as drafts
    const createdIdeas = [];
    for (const item of generated) {
      const created = await this.prisma.idea.create({
        data: {
          title: item.title,
          topic: idea.topic,
          description: item.description,
          language: idea.language,
          tags: idea.tags,
          status: 'draft',
        },
      });
      createdIdeas.push(created);
    }
    return createdIdeas;
  }

  async generateScript(id: string): Promise<string> {
    await this.prisma.idea.update({
      where: { id },
      data: { status: 'generating' },
    });
    const idea = await this.findOne(id);
    const taskId = `script-gen-${Date.now()}`;
    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const engineDir = path.join(projectRoot, 'engine');
    const taskStorageDir = path.join(engineDir, 'storage', 'tasks', taskId);

    const args = [
      'engine/cli.py',
      '--video-subject', idea.title,
      '--stop-at', 'script',
      '--task-id', taskId,
      '--video-language', idea.language,
    ];

    if (idea.description) {
      args.push('--video-script-prompt', idea.description);
    }

    return new Promise((resolve, reject) => {
      const pyProcess = spawn('uv', ['run', '--project', 'engine', 'python', ...args], {
        cwd: projectRoot,
      });

      pyProcess.on('close', async (code) => {
        if (code !== 0) {
          await this.prisma.idea.update({
            where: { id },
            data: { status: 'draft' },
          }).catch(() => {});
          return reject(new Error(`Tạo kịch bản thất bại với mã lỗi ${code}`));
        }

        try {
          const scriptJsonPath = path.join(taskStorageDir, 'script.json');
          if (!fs.existsSync(scriptJsonPath)) {
            await this.prisma.idea.update({
              where: { id },
              data: { status: 'draft' },
            }).catch(() => {});
            return reject(new Error('Không tìm thấy file kịch bản output'));
          }

          const scriptData = JSON.parse(fs.readFileSync(scriptJsonPath, 'utf8'));
          const generatedScript = scriptData.script;

          // Update idea in database
          await this.prisma.idea.update({
            where: { id },
            data: {
              script: generatedScript,
              status: 'ready',
            },
          });

          // Cleanup temp folder
          if (fs.existsSync(taskStorageDir)) {
            fs.rmSync(taskStorageDir, { recursive: true, force: true });
          }

          resolve(generatedScript);
        } catch (err) {
          await this.prisma.idea.update({
            where: { id },
            data: { status: 'draft' },
          }).catch(() => {});
          reject(err);
        }
      });
    });
  }

  async generateVideo(id: string, config: any) {
    const idea = await this.findOne(id);
    
    // Create new Generation Job
    const job = await this.prisma.generationJob.create({
      data: {
        ideaId: id,
        status: 'queued',
        config: config || {},
      },
    });

    // Add to BullMQ Queue
    await this.queueService.addVideoJob(
      job.id,
      id,
      idea.title,
      idea.script || undefined,
      idea.language,
      config || {},
    );

    return job;
  }
}
