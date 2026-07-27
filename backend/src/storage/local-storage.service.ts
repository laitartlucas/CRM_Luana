import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

/**
 * Armazenamento local em disco para o MVP. Em produção, trocar por um
 * provider de object storage (S3/Cloud Storage) — a interface pública
 * (`save`) é o único ponto que precisaria mudar.
 */
@Injectable()
export class LocalStorageService {
  async save(subfolder: string, originalName: string, buffer: Buffer): Promise<string> {
    const dir = join(UPLOAD_ROOT, subfolder);
    await mkdir(dir, { recursive: true });
    const safeName = `${randomUUID()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await writeFile(join(dir, safeName), buffer);
    return `/uploads/${subfolder}/${safeName}`;
  }
}
