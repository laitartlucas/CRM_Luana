import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Criptografia simétrica (AES-256-GCM) para segredos armazenados em
 * repouso — hoje usada nos tokens OAuth do Google (ver
 * GoogleCalendarConnection). A chave nunca fica no banco, só em
 * ENCRYPTION_KEY (variável de ambiente / secret manager).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const base64Key = this.config.get<string>('ENCRYPTION_KEY');
    if (!base64Key) {
      throw new Error('ENCRYPTION_KEY não configurada.');
    }
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY deve ser uma chave de 32 bytes em base64.');
    }
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, dataB64] = payload.split('.');
    if (!ivB64 || !authTagB64 || !dataB64) {
      throw new Error('Payload criptografado em formato inválido.');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
