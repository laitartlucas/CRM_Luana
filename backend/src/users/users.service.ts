import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMessageTemplatesDto } from './dto/update-message-templates.dto';
import { defaultMessageTemplates, MESSAGE_TEMPLATE_META, MessageTemplates } from '../whatsapp/message-templates';

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  timezone: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.user.findMany({ select: PUBLIC_SELECT, orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_SELECT });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        timezone: dto.timezone ?? 'America/Sao_Paulo',
      },
      select: PUBLIC_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);
    return this.prisma.user.update({ where: { id }, data: dto, select: PUBLIC_SELECT });
  }

  async deactivate(id: string) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: PUBLIC_SELECT,
    });
  }

  /** Lista de profissionais com agenda, usada pelos módulos de appointments/dashboard. */
  async listProfessionals() {
    return this.prisma.user.findMany({
      where: { active: true },
      select: PUBLIC_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * MVP: negócio de 1 consultora principal — os fluxos que precisam de um
   * profissional "dono" da ação (motor de conversa do WhatsApp, criação de
   * call comercial pelo Pipeline) usam a primeira profissional ativa. Ver
   * docs/04-plano-implementacao.md Fase 3 para o caminho de evolução
   * multi-profissional.
   */
  async getDefaultProfessional() {
    const professional = await this.prisma.user.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!professional) throw new NotFoundException('Nenhum profissional cadastrado no sistema.');
    return professional;
  }

  /** Padrões de mensagem do WhatsApp configurados pela própria usuária, com metadados de variáveis para a UI. */
  async getMessageTemplates(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { messageTemplates: true } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    const saved = (user.messageTemplates as MessageTemplates | null) ?? {};
    const defaults = defaultMessageTemplates();
    return {
      templates: Object.fromEntries(
        Object.keys(defaults).map((key) => [key, saved[key as keyof MessageTemplates] ?? defaults[key as keyof MessageTemplates]]),
      ),
      meta: MESSAGE_TEMPLATE_META,
    };
  }

  async updateMessageTemplates(userId: string, dto: UpdateMessageTemplatesDto) {
    await this.findById(userId);
    const entries = Object.entries(dto).filter(([, value]) => value !== undefined);
    const patch = Object.fromEntries(entries.map(([key, value]) => [key, (value as string).trim() || null]));
    const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { messageTemplates: true } });
    const merged = { ...((current?.messageTemplates as MessageTemplates | null) ?? {}), ...patch };
    // Remove entradas nulas (voltaram ao padrão) em vez de gravar "null" no JSON.
    for (const key of Object.keys(merged)) {
      if (!(merged as any)[key]) delete (merged as any)[key];
    }
    await this.prisma.user.update({ where: { id: userId }, data: { messageTemplates: merged } });
    return this.getMessageTemplates(userId);
  }
}
