import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';

@Processor('video-generation', { concurrency: 1 })
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { jobId, ideaId, subject, script, language, config } = job.data;
    this.logger.log(`Processing video generation job: ${jobId}`);

    // Update job status to running in DB
    await this.prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date(),
        progress: 5,
      },
    });

    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const engineDir = path.join(projectRoot, 'engine');
    const taskStorageDir = path.join(engineDir, 'storage', 'tasks', jobId);

    // Build args
    const args = [
      'engine/cli.py',
      '--video-subject',
      subject,
      '--task-id',
      jobId,
    ];

    if (script) {
      args.push('--video-script', script);
    }
    if (language) {
      args.push('--video-language', language);
    }
    if (config.voice_name) {
      args.push('--voice-name', config.voice_name);
    }
    if (config.aspect_ratio) {
      args.push('--video-aspect', config.aspect_ratio);
    }
    if (config.video_source) {
      args.push('--video-source', config.video_source);
    }
    if (config.video_concat_mode) {
      args.push('--video-concat-mode', config.video_concat_mode);
    }
    if (config.bgm_type) {
      args.push('--bgm-type', config.bgm_type);
    }
    if (config.bgm_file) {
      args.push('--bgm-file', config.bgm_file);
    }
    if (config.bgm_volume !== undefined) {
      args.push('--bgm-volume', config.bgm_volume.toString());
    }
    if (config.font_name) {
      args.push('--font-name', config.font_name);
    }
    if (config.font_size) {
      args.push('--font-size', config.font_size.toString());
    }
    if (config.stroke_color) {
      args.push('--stroke-color', config.stroke_color);
    }
    if (config.stroke_width !== undefined) {
      args.push('--stroke-width', config.stroke_width.toString());
    }

    this.logger.log(
      `Executing: uv run --project engine python ${args.join(' ')}`,
    );

    return new Promise((resolve, reject) => {
      // Spawn python CLI using uv run
      const pyProcess = spawn(
        'uv',
        ['run', '--project', 'engine', 'python', ...args],
        {
          cwd: projectRoot,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        },
      );

      const logAndSave = async (
        dataStr: string,
        stream: 'stdout' | 'stderr',
      ) => {
        const lines = dataStr.split(/\r?\n/).filter((line) => line.trim());
        for (const line of lines) {
          this.logger.debug(`[Engine ${stream}] ${line}`);

          // Write log line to DB
          await this.prisma.jobLog
            .create({
              data: {
                jobId,
                level: stream === 'stderr' ? 'warn' : 'info',
                message: line,
              },
            })
            .catch((err) =>
              this.logger.error('Failed to write log to DB:', err),
            );

          // Analyze log to update progress
          // Order matches actual engine pipeline in task.py:
          // script → terms → audio → subtitle → materials → combining → generating
          let progress = -1;
          let status = '';

          if (line.includes('## generating video script')) {
            status = 'generating_script';
            progress = 10;
          } else if (line.includes('## generating video terms')) {
            status = 'generating_script';
            progress = 20;
          } else if (line.includes('## generating audio')) {
            status = 'generating_voice';
            progress = 35;
          } else if (
            line.includes('## generating subtitle') ||
            line.includes('## correcting subtitle')
          ) {
            status = 'generating_subtitle';
            progress = 50;
          } else if (line.includes('## preprocess local materials')) {
            status = 'fetching_materials';
            progress = 60;
          } else if (line.includes('## downloading videos from')) {
            status = 'fetching_materials';
            progress = 65;
          } else if (line.includes('## combining video')) {
            status = 'rendering';
            progress = 75;
          } else if (line.includes('## generating video')) {
            status = 'rendering';
            progress = 88;
          } else if (
            line.includes('Writing video') ||
            line.includes('MoviePy') ||
            line.includes('video writer')
          ) {
            status = 'rendering';
            progress = 92;
          }

          if (progress !== -1) {
            const updateData: any = { progress };
            if (status) {
              updateData.status = status;
            }
            await this.prisma.generationJob
              .update({
                where: { id: jobId },
                data: updateData,
              })
              .catch(() => {});
          }
        }
      };

      pyProcess.stdout.on('data', (data) =>
        logAndSave(data.toString(), 'stdout'),
      );
      pyProcess.stderr.on('data', (data) =>
        logAndSave(data.toString(), 'stderr'),
      );

      pyProcess.on('close', async (code) => {
        this.logger.log(`Engine CLI completed with code: ${code}`);

        if (code !== 0) {
          const errMsg = `CLI execution failed with exit code ${code}`;
          await this.prisma.generationJob.update({
            where: { id: jobId },
            data: {
              status: 'failed',
              errorMessage: errMsg,
              finishedAt: new Date(),
            },
          });
          return reject(new Error(errMsg));
        }

        try {
          // Process success
          await this.prisma.generationJob.update({
            where: { id: jobId },
            data: { status: 'uploading', progress: 90 },
          });

          // Check if output files exist
          const finalVideoPath = path.join(taskStorageDir, 'final-1.mp4');
          const subtitlePath = path.join(taskStorageDir, 'subtitle.srt');
          const scriptJsonPath = path.join(taskStorageDir, 'script.json');

          if (!fs.existsSync(finalVideoPath)) {
            throw new Error(
              `Output video file final-1.mp4 not found at ${finalVideoPath}`,
            );
          }

          // Generate thumbnail
          const thumbnailFilename = 'thumbnail.jpg';
          const thumbnailPath = path.join(taskStorageDir, thumbnailFilename);
          await new Promise<void>((res, rej) => {
            ffmpeg(finalVideoPath)
              .screenshots({
                count: 1,
                timemarks: ['2'], // Extract at 2 seconds
                filename: thumbnailFilename,
                folder: taskStorageDir,
              })
              .on('end', () => res())
              .on('error', (err: any) => rej(err));
          });

          // Upload files to MinIO
          const s3VideoKey = `videos/${jobId}/final.mp4`;
          const s3ThumbnailKey = `videos/${jobId}/thumbnail.jpg`;
          const s3SubtitleKey = `videos/${jobId}/subtitle.srt`;
          const s3ScriptKey = `videos/${jobId}/script.json`;

          await this.storage.uploadFile(
            finalVideoPath,
            s3VideoKey,
            'video/mp4',
          );
          if (fs.existsSync(thumbnailPath)) {
            await this.storage.uploadFile(
              thumbnailPath,
              s3ThumbnailKey,
              'image/jpeg',
            );
          }
          if (fs.existsSync(subtitlePath)) {
            await this.storage.uploadFile(
              subtitlePath,
              s3SubtitleKey,
              'text/plain',
            );
          }
          if (fs.existsSync(scriptJsonPath)) {
            await this.storage.uploadFile(
              scriptJsonPath,
              s3ScriptKey,
              'application/json',
            );
          }

          // Parse script data
          let scriptContent = script;
          if (fs.existsSync(scriptJsonPath)) {
            try {
              const scriptData = JSON.parse(
                fs.readFileSync(scriptJsonPath, 'utf8'),
              );
              scriptContent = scriptData.script || script;
            } catch (e) {
              this.logger.error('Failed to parse script.json:', e);
            }
          }

          // Create Video record in database
          const video = await this.prisma.video.create({
            data: {
              ideaId,
              jobId,
              title: subject,
              script: scriptContent,
              videoObjectKey: s3VideoKey,
              thumbnailObjectKey: fs.existsSync(thumbnailPath)
                ? s3ThumbnailKey
                : null,
              subtitleObjectKey: fs.existsSync(subtitlePath)
                ? s3SubtitleKey
                : null,
              metadataObjectKey: fs.existsSync(scriptJsonPath)
                ? s3ScriptKey
                : null,
              ratio: config.aspect_ratio || '9:16',
            },
          });

          // Update job to completed
          await this.prisma.generationJob.update({
            where: { id: jobId },
            data: {
              status: 'completed',
              progress: 100,
              finishedAt: new Date(),
            },
          });

          // Clean up taskStorageDir
          if (fs.existsSync(taskStorageDir)) {
            fs.rmSync(taskStorageDir, { recursive: true, force: true });
          }

          resolve(video);
        } catch (err: any) {
          this.logger.error('Post-processing failed:', err);
          await this.prisma.generationJob.update({
            where: { id: jobId },
            data: {
              status: 'failed',
              errorMessage: err.message || 'Post-processing failed',
              finishedAt: new Date(),
            },
          });
          reject(err);
        }
      });
    });
  }
}
