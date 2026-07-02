import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execSync } from 'child_process';
import { PrismaService } from './modules/database/prisma.service';

async function runDatabasePush() {
  const logger = new Logger('DatabaseInit');
  let retries = 10;
  while (retries > 0) {
    try {
      logger.log('Synchronizing database schema (npx prisma db push)...');
      execSync('npx prisma db push', { stdio: 'inherit' });
      logger.log('Database schema synchronized successfully.');
      break;
    } catch (error: any) {
      retries--;
      logger.error(
        `Database connection/synchronization failed. Retries left: ${retries}. Retrying in 5 seconds...`,
      );
      if (retries === 0) {
        logger.error('Failed to initialize database schema after 10 attempts. Exiting.');
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function recoverStuckJobs(prisma: PrismaService) {
  const logger = new Logger('JobRecovery');
  try {
    const stuckJobs = await prisma.generationJob.findMany({
      where: { status: { in: ['running', 'queued'] } },
    });
    if (stuckJobs.length === 0) {
      logger.log('No stuck jobs found.');
      return;
    }
    logger.warn(`Found ${stuckJobs.length} stuck jobs from before restart. Failing them...`);
    for (const job of stuckJobs) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: 'Server restarted while job was in progress. Please retry.',
          finishedAt: new Date(),
        },
      });
    }
    logger.log(`Recovered ${stuckJobs.length} stuck jobs.`);
  } catch (error: any) {
    logger.error('Failed to recover stuck jobs:', error);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Run db push before loading the NestJS application
  await runDatabasePush();

  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:23000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 23001);

  await app.listen(port);
  logger.log(`NestJS application is running on: http://localhost:${port}/api`);

  // Recover stuck jobs from before restart
  const prisma = app.get(PrismaService);
  await recoverStuckJobs(prisma);
}
bootstrap();
