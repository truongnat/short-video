import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './modules/database/database.module';
import { StorageModule } from './modules/storage/storage.module';
import { LlmModule } from './modules/llm/llm.module';
import { IdeasModule } from './modules/ideas/ideas.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { VideosModule } from './modules/videos/videos.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    StorageModule,
    LlmModule,
    IdeasModule,
    JobsModule,
    VideosModule,
    SettingsModule,
  ],
})
export class AppModule {}
