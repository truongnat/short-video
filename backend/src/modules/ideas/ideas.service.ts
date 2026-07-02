import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';
import { QueueService, type VideoJobConfig } from '../queue/queue.service';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

type ScriptFile = {
  script: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class IdeasService {
  private readonly logger = new Logger(IdeasService.name);
  private readonly activeGenerationStatuses = [
    'queued',
    'running',
    'generating_script',
    'fetching_materials',
    'generating_voice',
    'generating_subtitle',
    'rendering',
    'uploading',
  ] as const;

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private queueService: QueueService,
  ) {}

  private normalizeTitle(title: string) {
    return title.trim().toLowerCase().replace(/\s+/g, ' ');
  }

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
      void this.generateScript(idea.id).catch((err: unknown) => {
        this.logger.error(
          `Failed to auto-generate script for idea ${idea.id}: ${getErrorMessage(err)}`,
        );
      });
    }

    return idea;
  }

  async findAll() {
    return this.prisma.idea.findMany({
      select: {
        id: true,
        title: true,
        topic: true,
        language: true,
        tags: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            progress: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
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

  async update(
    id: string,
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

  async brainstorm(dto: {
    topic: string;
    language: string;
    existingTitles?: string[];
  }) {
    const existingIdeas = await this.prisma.idea.findMany({
      where: { topic: dto.topic },
      select: { title: true },
    });
    const existingTitles = new Set(
      [
        ...(dto.existingTitles || []),
        ...existingIdeas.map((idea) => idea.title),
      ]
        .map((title) => this.normalizeTitle(title))
        .filter(Boolean),
    );
    const generated = await this.llm.generateIdeas(dto.topic, dto.language, {
      existingTitles: Array.from(existingTitles),
    });
    const createdIdeas = [];
    for (const item of generated) {
      const normalizedTitle = this.normalizeTitle(item.title);
      if (existingTitles.has(normalizedTitle)) {
        continue;
      }
      existingTitles.add(normalizedTitle);
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
      void this.generateScript(idea.id).catch((err: unknown) => {
        this.logger.error(
          `Failed to auto-generate script for brainstormed idea ${idea.id}: ${getErrorMessage(err)}`,
        );
      });
    }

    return createdIdeas;
  }

  async generateMore(id: string) {
    const idea = await this.findOne(id);
    const siblingIdeas = await this.prisma.idea.findMany({
      where: { topic: idea.topic },
      select: { title: true },
    });
    const knownTitles = new Set(
      siblingIdeas
        .map((item) => this.normalizeTitle(item.title))
        .filter(Boolean),
    );
    const generated = await this.llm.generateIdeas(idea.topic, idea.language, {
      existingTitles: Array.from(knownTitles),
      anchorTitle: idea.title,
      anchorDescription: idea.description || undefined,
    });

    const createdIdeas = [];
    for (const item of generated) {
      const normalizedTitle = this.normalizeTitle(item.title);
      if (knownTitles.has(normalizedTitle)) {
        continue;
      }
      knownTitles.add(normalizedTitle);
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

  async batchGenerateVideo(topic: string, config: VideoJobConfig) {
    const ideas = await this.prisma.idea.findMany({
      where: {
        topic,
        script: { not: null },
        status: 'ready',
      },
    });

    const activeJobs = await this.prisma.generationJob.findMany({
      where: {
        ideaId: { in: ideas.map((idea) => idea.id) },
        status: { in: [...this.activeGenerationStatuses] },
      },
      select: {
        ideaId: true,
      },
    });
    const blockedIdeaIds = new Set(activeJobs.map((job) => job.ideaId));

    const jobs = [];
    for (const idea of ideas) {
      if (blockedIdeaIds.has(idea.id)) {
        continue;
      }
      if (!idea.script?.trim()) {
        continue;
      }

      const job = await this.prisma.generationJob.create({
        data: {
          ideaId: idea.id,
          status: 'queued',
          config,
        },
      });
      await this.queueService.addVideoJob(
        job.id,
        idea.id,
        idea.title,
        idea.script || undefined,
        idea.language,
        config,
      );
      jobs.push(job);
    }
    return { topic, count: jobs.length, jobs };
  }

  async generateScript(id: string): Promise<string | null> {
    const existingIdea = await this.findOne(id);
    if (existingIdea.status === 'generating') {
      return null;
    }

    const activeProvider = await this.llm.getActiveProviderConfig();
    if (!activeProvider.apiKey) {
      throw new BadRequestException(
        'Chưa cấu hình API key cho AI provider hiện tại. Vào Cài đặt để bật tính năng tạo kịch bản.',
      );
    }

    const result = await this.prisma.idea.updateMany({
      where: { id, status: existingIdea.status },
      data: { status: 'generating' },
    });
    if (result.count === 0) {
      return null;
    }

    const taskId = `script-gen-${crypto.randomUUID()}`;
    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const engineDir = path.join(projectRoot, 'engine');
    const taskStorageDir = path.join(engineDir, 'storage', 'tasks', taskId);

    const args = [
      'engine/cli.py',
      '--video-subject',
      existingIdea.title,
      '--stop-at',
      'script',
      '--task-id',
      taskId,
      '--video-language',
      existingIdea.language,
    ];

    if (existingIdea.description) {
      args.push('--video-script-prompt', existingIdea.description);
    }

    return new Promise<string | null>((resolve, reject) => {
      let settled = false;
      const pyProcess = spawn(
        'uv',
        ['run', '--project', 'engine', 'python', ...args],
        {
          cwd: projectRoot,
        },
      );

      const cg = () =>
        this.cleanupScriptGeneration(
          id,
          existingIdea.status,
          taskStorageDir,
        ).catch(() => {});

      pyProcess.on('error', (err) => {
        if (!settled) {
          settled = true;
          void cg();
          reject(err);
        }
      });

      pyProcess.on('close', (code) => {
        if (settled) return;
        settled = true;

        if (code !== 0) {
          void cg();
          return reject(new Error(`Tạo kịch bản thất bại với mã lỗi ${code}`));
        }

        void (async () => {
          try {
            const scriptJsonPath = path.join(taskStorageDir, 'script.json');
            if (!fs.existsSync(scriptJsonPath)) {
              void cg();
              reject(new Error('Không tìm thấy file kịch bản output'));
              return;
            }

            const scriptData = JSON.parse(
              fs.readFileSync(scriptJsonPath, 'utf8'),
            ) as ScriptFile;
            const generatedScript = scriptData.script;

            await this.prisma.idea.update({
              where: { id },
              data: {
                script: generatedScript,
                status: 'ready',
              },
            });

            this.cleanupTaskDir(taskStorageDir);
            resolve(generatedScript);
          } catch (err: unknown) {
            void cg();
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        })();
      });
    });
  }

  private async cleanupScriptGeneration(
    id: string,
    fallbackStatus: string,
    taskStorageDir: string,
  ) {
    try {
      await this.prisma.idea.update({
        where: { id },
        data: { status: fallbackStatus },
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to restore idea status after script generation: ${getErrorMessage(err)}`,
      );
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

  async generateVideo(id: string, config: VideoJobConfig) {
    const idea = await this.findOne(id);
    if (!idea.script?.trim()) {
      throw new BadRequestException(
        'Ý tưởng chưa có kịch bản. Hãy tạo hoặc nhập kịch bản trước khi sinh video.',
      );
    }

    const activeJob = await this.prisma.generationJob.findFirst({
      where: {
        ideaId: id,
        status: { in: [...this.activeGenerationStatuses] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (activeJob) {
      throw new BadRequestException('Ý tưởng này đã có job đang chạy');
    }

    // Create new Generation Job
    const job = await this.prisma.generationJob.create({
      data: {
        ideaId: id,
        status: 'queued',
        config,
      },
    });

    // Add to BullMQ Queue
    await this.queueService.addVideoJob(
      job.id,
      id,
      idea.title,
      idea.script || undefined,
      idea.language,
      config,
    );

    return job;
  }
}
