import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execSync } from 'child_process';

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

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Run db push before loading the NestJS application
  await runDatabasePush();

  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: '*',
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
}
bootstrap();
