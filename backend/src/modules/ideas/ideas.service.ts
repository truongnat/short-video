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

  async brainstorm(dto: { topic: string; language: string; existingTitles?: string[] }): Promise<any[]> {
    const existingTitles = dto.existingTitles || [];
    const generated = await this.llm.generateIdeas(dto.topic, dto.language);
    const createdIdeas = [];
    for (const item of generated) {
      if (existingTitles.some((t) => t.toLowerCase().trim() === item.title.toLowerCase().trim())) {
        continue;
      }
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

  async batchGenerateVideo(topic: string, config: any) {
    const ideas = await this.prisma.idea.findMany({
      where: {
        topic,
        script: { not: null },
        status: 'ready',
      },
    });

    const jobs = [];
    for (const idea of ideas) {
      const job = await this.prisma.generationJob.create({
        data: {
          ideaId: idea.id,
          status: 'queued',
          config: config || {},
        },
      });
      await this.queueService.addVideoJob(
        job.id,
        idea.id,
        idea.title,
        idea.script || undefined,
        idea.language,
        config || {},
      );
      jobs.push(job);
    }
    return { topic, count: jobs.length, jobs };
  }

  async generateScript(id: string): Promise<string | null> {
    // Atomic check: only generate if currently draft
    const result = await this.prisma.idea.updateMany({
      where: { id, status: 'draft' },
      data: { status: 'generating' },
    });
    if (result.count === 0) {
      return null; // Already generating, already has script, or not found
    }

    const idea = await this.findOne(id);
    const taskId = `script-gen-${crypto.randomUUID()}`;
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
      let settled = false;
      const pyProcess = spawn('uv', ['run', '--project', 'engine', 'python', ...args], {
        cwd: projectRoot,
      });

      const cg = () => this.cleanupScriptGeneration(id, taskStorageDir).catch(() => {});

      pyProcess.on('error', (err) => {
        if (!settled) {
          settled = true;
          cg();
          reject(err);
        }
      });

      pyProcess.on('close', async (code) => {
        if (settled) return;
        settled = true;

        if (code !== 0) {
          cg();
          return reject(new Error(`Tạo kịch bản thất bại với mã lỗi ${code}`));
        }

        try {
          const scriptJsonPath = path.join(taskStorageDir, 'script.json');
          if (!fs.existsSync(scriptJsonPath)) {
            cg();
            return reject(new Error('Không tìm thấy file kịch bản output'));
          }

          const scriptData = JSON.parse(fs.readFileSync(scriptJsonPath, 'utf8'));
          const generatedScript = scriptData.script;

          await this.prisma.idea.update({
            where: { id },
            data: {
              script: generatedScript,
              status: 'ready',
            },
          });

          await this.cleanupTaskDir(taskStorageDir);
          resolve(generatedScript);
        } catch (err) {
          cg();
          reject(err);
        }
      });
    });
  }

  private async cleanupScriptGeneration(id: string, taskStorageDir: string) {
    try {
      await this.prisma.idea.update({
        where: { id },
        data: { status: 'draft' },
      });
    } catch (err) {
      this.logger.error('Failed to reset idea status to draft:', err);
    }
    this.cleanupTaskDir(taskStorageDir);
  }

  private cleanupTaskDir(dir: string) {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
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
