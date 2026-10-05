import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMessageTemplatesDto } from './dto/update-message-templates.dto';
import { CreateCustomMessageTemplateDto, UpdateCustomMessageTemplateDto } from './dto/custom-message-template.dto';
import {
  CustomMessageTemplate,
  defaultMessageTemplates,
  MESSAGE_TEMPLATE_META,
  MessageTemplates,
} from '../whatsapp/message-templates';

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

  /** Impede deixar o sistema sem nenhum ADMIN ativo (rebaixar, desativar ou trocar o papel do último). */
  private async assertNotLastAdmin(id: string) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true, active: true } });
    if (target?.role !== Role.ADMIN || !target.active) return;
    const otherAdmins = await this.prisma.user.count({ where: { role: Role.ADMIN, active: true, id: { not: id } } });
    if (otherAdmins === 0) {
      throw new BadRequestException('Não é possível remover o último administrador ativo do sistema.');
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);
    const losesAdmin = dto.role !== undefined && dto.role !== Role.ADMIN;
    if (losesAdmin) await this.assertNotLastAdmin(id);
    // Papel mudou: derruba as sessões abertas para o novo papel valer já no próximo login.
    const revoke = dto.role !== undefined ? { tokenVersion: { increment: 1 } } : {};
    return this.prisma.user.update({ where: { id }, data: { ...dto, ...revoke }, select: PUBLIC_SELECT });
  }

  async deactivate(id: string) {
    await this.findById(id);
    await this.assertNotLastAdmin(id);
    return this.prisma.user.update({
      where: { id },
      data: { active: false, tokenVersion: { increment: 1 } },
      select: PUBLIC_SELECT,
    });
  }

  /** A própria pessoa troca a senha confirmando a atual; todas as sessões abertas são encerradas. */
  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }
    await this.setPassword(userId, newPassword);
    return { ok: true };
  }

  /** Redefinição por um ADMIN (esqueceu a senha). Também encerra as sessões do usuário. */
  async resetPassword(id: string, newPassword: string) {
    await this.findById(id);
    await this.setPassword(id, newPassword);
    return { ok: true };
  }

  private async setPassword(id: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null },
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { messageTemplates: true, customMessageTemplates: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    const saved = (user.messageTemplates as MessageTemplates | null) ?? {};
    const defaults = defaultMessageTemplates();
    return {
      templates: Object.fromEntries(
        Object.keys(defaults).map((key) => [key, saved[key as keyof MessageTemplates] ?? defaults[key as keyof MessageTemplates]]),
      ),
      meta: MESSAGE_TEMPLATE_META,
      custom: (user.customMessageTemplates as CustomMessageTemplate[] | null) ?? [],
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

  // -----------------------------------------------------------------
  // Mensagens personalizadas — sem chave fixa, a usuária cria/apaga
  // quantas quiser (ver CustomMessageTemplate).
  // -----------------------------------------------------------------

  private async getCustomTemplates(userId: string): Promise<CustomMessageTemplate[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { customMessageTemplates: true } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return (user.customMessageTemplates as CustomMessageTemplate[] | null) ?? [];
  }

  async addCustomTemplate(userId: string, dto: CreateCustomMessageTemplateDto) {
    const current = await this.getCustomTemplates(userId);
    const next = [...current, { id: randomUUID(), label: dto.label.trim(), text: dto.text.trim() }];
    await this.prisma.user.update({ where: { id: userId }, data: { customMessageTemplates: next as any } });
    return this.getMessageTemplates(userId);
  }

  async updateCustomTemplate(userId: string, templateId: string, dto: UpdateCustomMessageTemplateDto) {
    const current = await this.getCustomTemplates(userId);
    const index = current.findIndex((t) => t.id === templateId);
    if (index === -1) throw new NotFoundException('Mensagem personalizada não encontrada.');
    const next = [...current];
    next[index] = {
      ...next[index],
      ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
      ...(dto.text !== undefined ? { text: dto.text.trim() } : {}),
    };
    await this.prisma.user.update({ where: { id: userId }, data: { customMessageTemplates: next as any } });
    return this.getMessageTemplates(userId);
  }

  async removeCustomTemplate(userId: string, templateId: string) {
    const current = await this.getCustomTemplates(userId);
    const next = current.filter((t) => t.id !== templateId);
    if (next.length === current.length) throw new NotFoundException('Mensagem personalizada não encontrada.');
    await this.prisma.user.update({ where: { id: userId }, data: { customMessageTemplates: next as any } });
    return this.getMessageTemplates(userId);
  }
}
