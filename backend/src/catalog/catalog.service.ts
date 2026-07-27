import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeInactive = false) {
    return this.prisma.service.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Serviço não encontrado.');
    return service;
  }

  async create(dto: CreateServiceDto) {
    return this.prisma.service.create({ data: dto });
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findById(id);
    return this.prisma.service.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findById(id);
    return this.prisma.service.update({ where: { id }, data: { active: false } });
  }
}
