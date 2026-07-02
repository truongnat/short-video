import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { Buffer } from 'node:buffer';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import { type VideoJobPayload } from './queue.service';

export const cancelledJobs = new Set<string>();

type ScriptFile = {
  script?: string;
};

type JobProgressUpdate = {
  progress: number;
  status?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Processor('video-generation', { concurrency: 1 })
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<VideoJobPayload, unknown, string>): Promise<unknown> {
    const { jobId, ideaId, subject, script, language, config } = job.data;
    this.logger.log(`Processing video generation job: ${jobId}`);

    // Check if job was cancelled before starting
    if (cancelledJobs.has(jobId)) {
      cancelledJobs.delete(jobId);
      throw new Error('Job was cancelled before processing started');
    }

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
      let pyProcess: ChildProcessWithoutNullStreams | null = null;
      let logQueue: Promise<void> = Promise.resolve();
      let settled = false;

      const cleanup = () => {
        if (pyProcess && !pyProcess.killed) {
          pyProcess.kill('SIGTERM');
          setTimeout(() => {
            if (pyProcess && !pyProcess.killed) pyProcess.kill('SIGKILL');
          }, 5000);
        }
      };

      const markFailed = async (errMsg: string) => {
        cleanup();
        this.logger.error(`Job ${jobId} failed: ${errMsg}`);
        await this.prisma.generationJob
          .update({
            where: { id: jobId },
            data: {
              status: 'failed',
              errorMessage: errMsg,
              finishedAt: new Date(),
            },
          })
          .catch((err: unknown) =>
            this.logger.error(
              `Failed to mark job as failed: ${getErrorMessage(err)}`,
            ),
          );
      };

      const logAndSave = async (
        dataStr: string,
        stream: 'stdout' | 'stderr',
      ) => {
        const lines = dataStr.split(/\r?\n/).filter((line) => line.trim());
        for (const line of lines) {
          this.logger.debug(`[Engine ${stream}] ${line}`);

          // Check if cancelled
          if (cancelledJobs.has(jobId)) {
            cancelledJobs.delete(jobId);
            cleanup();
            return;
          }

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
            const updateData: JobProgressUpdate = { progress };
            if (status) {
              updateData.status = status;
            }
            await this.prisma.generationJob
              .update({
                where: { id: jobId },
                data: updateData,
              })
              .catch(() => undefined);
          }
        }
      };

      // Spawn python CLI using uv run
      pyProcess = spawn(
        'uv',
        ['run', '--project', 'engine', 'python', ...args],
        {
          cwd: projectRoot,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        },
      );

      if (pyProcess.stdout) {
        pyProcess.stdout.on('data', (data: Buffer) => {
          logQueue = logQueue.then(() => logAndSave(data.toString(), 'stdout'));
        });
        pyProcess.stdout.on('error', (err) => {
          this.logger.error(`stdout stream error: ${err.message}`);
        });
      }

      if (pyProcess.stderr) {
        pyProcess.stderr.on('data', (data: Buffer) => {
          logQueue = logQueue.then(() => logAndSave(data.toString(), 'stderr'));
        });
        pyProcess.stderr.on('error', (err) => {
          this.logger.error(`stderr stream error: ${err.message}`);
        });
      }

      pyProcess.on('error', (err) => {
        if (settled) return;
        settled = true;
        this.logger.error(`Failed to spawn process: ${err.message}`);
        void markFailed(`Process spawn failed: ${err.message}`);
        reject(err);
      });

      pyProcess.on('close', (code) => {
        if (settled) return;
        settled = true;
        void (async () => {
          // Wait for all pending log writes
          await logQueue;

          // Check if cancelled during processing
          if (cancelledJobs.has(jobId)) {
            cancelledJobs.delete(jobId);
            reject(new Error('Job was cancelled'));
            return;
          }

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
            reject(new Error(errMsg));
            return;
          }

          try {
            // Check if video already exists (idempotency for worker retries)
            const existing = await this.prisma.video.findFirst({
              where: { jobId },
            });
            if (existing) {
              this.logger.log(
                `Video record already exists for job ${jobId}, skipping creation`,
              );
              await this.prisma.generationJob.update({
                where: { id: jobId },
                data: {
                  status: 'completed',
                  progress: 100,
                  finishedAt: new Date(),
                },
              });
              resolve(existing);
              return;
            }

            // Process success
            await this.prisma.generationJob.update({
              where: { id: jobId },
              data: { status: 'uploading', progress: 90 },
            });

            const finalVideoPath = path.join(taskStorageDir, 'final-1.mp4');
            const subtitlePath = path.join(taskStorageDir, 'subtitle.srt');
            const scriptJsonPath = path.join(taskStorageDir, 'script.json');

            if (!fs.existsSync(finalVideoPath)) {
              throw new Error(
                `Output video file final-1.mp4 not found at ${finalVideoPath}`,
              );
            }

            const thumbnailFilename = 'thumbnail.jpg';
            const thumbnailPath = path.join(taskStorageDir, thumbnailFilename);
            await new Promise<void>((res, rej) => {
              const timeout = setTimeout(() => {
                rej(
                  new Error('ffmpeg thumbnail generation timed out after 60s'),
                );
              }, 60000);
              ffmpeg(finalVideoPath)
                .screenshots({
                  count: 1,
                  timemarks: ['0'],
                  filename: thumbnailFilename,
                  folder: taskStorageDir,
                })
                .on('end', () => {
                  clearTimeout(timeout);
                  res();
                })
                .on('error', (err: Error) => {
                  clearTimeout(timeout);
                  rej(err);
                });
            });

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

            let scriptContent = script;
            if (fs.existsSync(scriptJsonPath)) {
              try {
                const scriptData = JSON.parse(
                  fs.readFileSync(scriptJsonPath, 'utf8'),
                ) as ScriptFile;
                scriptContent = scriptData.script || script;
              } catch (error: unknown) {
                this.logger.error(
                  `Failed to parse script.json: ${getErrorMessage(error)}`,
                );
              }
            }

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

            await this.prisma.generationJob.update({
              where: { id: jobId },
              data: {
                status: 'completed',
                progress: 100,
                finishedAt: new Date(),
              },
            });

            if (fs.existsSync(taskStorageDir)) {
              fs.rmSync(taskStorageDir, { recursive: true, force: true });
            }

            resolve(video);
          } catch (error: unknown) {
            this.logger.error(
              `Post-processing failed: ${getErrorMessage(error)}`,
            );
            await this.prisma.generationJob.update({
              where: { id: jobId },
              data: {
                status: 'failed',
                errorMessage: getErrorMessage(error),
                finishedAt: new Date(),
              },
            });
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        })();
      });
    });
  }
}
