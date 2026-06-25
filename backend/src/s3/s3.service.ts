import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly folder: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? 'bluerhine-erp';
    this.folder = (process.env.S3_FOLDER ?? 'dev').replace(/\/+$/, '');

    this.client = new S3Client({
      region: process.env.AWS_REGION ?? 'ap-south-1',
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  /**
   * Upload a base64 data-URL to S3.
   * Returns the S3 key (path within the bucket).
   */
  async upload(
    subfolder: string,
    fileName:  string,
    base64:    string,
    mimeType:  string,
  ): Promise<string> {
    const raw     = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer  = Buffer.from(raw, 'base64');
    const ts      = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key     = `${this.folder}/${subfolder}/${ts}-${safeName}`;

    await this.client.send(new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
    }));

    this.logger.log(`Uploaded s3://${this.bucket}/${key}`);
    return key;
  }

  /**
   * Generate a pre-signed GET URL valid for 60 minutes.
   */
  async presignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  /**
   * Fetch an S3 object and return it as a base64 data-URI string.
   * Used to proxy image content to the frontend without exposing CORS-restricted presigned URLs.
   */
  async getAsBase64(key: string, mimeType = 'application/octet-stream'): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const res = await this.client.send(cmd);
    // AWS SDK v3 Body in Node.js is AsyncIterable<Uint8Array>
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('base64');
    return `data:${mimeType};base64,${raw}`;
  }

  /**
   * Delete an object from S3.
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      this.logger.log(`Deleted s3://${this.bucket}/${key}`);
    } catch (err) {
      this.logger.warn(`S3 delete failed for key "${key}": ${(err as Error).message}`);
    }
  }

  get isConfigured(): boolean {
    return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET);
  }
}
