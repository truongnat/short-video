import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly publicS3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.configService.get<number>('MINIO_PORT', 29000);
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const publicEndpoint = this.configService.get<string>('MINIO_PUBLIC_ENDPOINT', endpoint);
    const publicPort = this.configService.get<number>('MINIO_PUBLIC_PORT', port);
    const publicUseSSL =
      this.configService.get<string>('MINIO_PUBLIC_USE_SSL', String(useSSL)) ===
      'true';
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin');
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME', 'videos');

    const credentials = {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    };

    this.s3Client = new S3Client({
      endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
      forcePathStyle: true,
      region: 'us-east-1',
      credentials,
    });

    this.publicS3Client = new S3Client({
      endpoint: `${publicUseSSL ? 'https' : 'http'}://${publicEndpoint}:${publicPort}`,
      forcePathStyle: true,
      region: 'us-east-1',
      credentials,
    });
  }

  async onModuleInit() {
    await this.createBucketIfNotExists();
  }

  private async createBucketIfNotExists() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`Bucket "${this.bucketName}" already exists.`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error['$metadata']?.httpStatusCode === 404) {
        this.logger.log(`Bucket "${this.bucketName}" not found. Creating it...`);
        try {
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
          this.logger.log(`Bucket "${this.bucketName}" created successfully.`);
        } catch (createError) {
          this.logger.error(`Failed to create bucket:`, createError);
        }
      } else {
        this.logger.error(`Error checking bucket existence:`, error);
      }
    }
  }

  async uploadFile(localPath: string, key: string, contentType: string): Promise<string> {
    const fileStream = fs.createReadStream(localPath);
    const streamError = new Promise<never>((_, reject) => {
      fileStream.on('error', (err) => {
        this.logger.error(`Failed to read file ${localPath}:`, err);
        reject(err);
      });
    });
    const upload = this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
      }),
    );
    await Promise.race([upload, streamError]);
    return key;
  }

  async uploadBuffer(buffer: Buffer, key: string, contentType: string): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async getDownloadUrl(key: string, expiresSeconds = 86400): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.publicS3Client, command, {
      expiresIn: expiresSeconds,
    });
  }

  async getFileStream(key: string): Promise<{
    stream: Readable;
    contentType?: string;
    contentLength?: number;
  }> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Object body missing for key: ${key}`);
    }

    return {
      stream: response.Body as Readable,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
  }
}
