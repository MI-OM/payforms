import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class StorageService {
  private supabaseUrl: string | undefined;
  private supabaseKey: string | undefined;
  private supabaseBucket: string | undefined;

  constructor(private configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    this.supabaseKey = this.configService.get<string>('SUPABASE_KEY');
    this.supabaseBucket = this.configService.get<string>('SUPABASE_BUCKET');
  }

  private ensureSupabaseConfig() {
    if (!this.supabaseUrl || !this.supabaseKey || !this.supabaseBucket) {
      throw new BadRequestException('Supabase storage is not fully configured. Set SUPABASE_URL, SUPABASE_KEY, and SUPABASE_BUCKET');
    }
  }

  async uploadFile(filePath: string, fileData: Buffer | string, contentType: string = 'application/octet-stream') {
    this.ensureSupabaseConfig();

    const url = `${this.supabaseUrl}/storage/v1/object/${this.supabaseBucket}/${encodeURIComponent(filePath)}`;

    try {
      await axios.put(url, fileData, {
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': contentType,
          Accept: 'application/json',
        },
      });
    } catch (error) {
      console.error('Supabase file upload failed', error);
      throw new InternalServerErrorException('Failed to upload file to Supabase storage');
    }

    return this.getPublicUrl(filePath);
  }

  getPublicUrl(filePath: string) {
    this.ensureSupabaseConfig();
    return `${this.supabaseUrl}/storage/v1/object/public/${this.supabaseBucket}/${encodeURIComponent(filePath)}`;
  }

  async deleteFile(filePath: string) {
    this.ensureSupabaseConfig();

    const url = `${this.supabaseUrl}/storage/v1/object/${this.supabaseBucket}/${encodeURIComponent(filePath)}`;

    try {
      await axios.delete(url, {
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
        },
      });
    } catch (error) {
      console.error('Supabase file delete failed', error);
      throw new InternalServerErrorException('Failed to delete file from Supabase storage');
    }

    return { success: true };
  }
}
