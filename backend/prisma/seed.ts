import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Caroline1209', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'luana@crm.local' },
    update: { name: 'Luana', passwordHash },
    create: {
      name: 'Luana',
      email: 'luana@crm.local',
      passwordHash,
      role: Role.ADMIN,
      timezone: 'America/Sao_Paulo',
    },
  });

  const services = [
    { name: 'Consultoria de Estilo Individual', durationMinutes: 90, price: 450 },
    { name: 'Personal Shopper (presencial)', durationMinutes: 180, price: 900 },
    { name: 'Personal Shopper (online)', durationMinutes: 90, price: 400 },
    { name: 'Guarda-roupa Cápsula', durationMinutes: 120, price: 700 },
    { name: 'Styling para Eventos', durationMinutes: 60, price: 350 },
    { name: 'Consultoria de Imagem Corporativa', durationMinutes: 120, price: 850 },
    // Usado pelo Pipeline Comercial ao mover uma lead para "Call agendada" —
    // não é um serviço vendável, por isso preço 0.
    { name: 'Call comercial', durationMinutes: 30, price: 0 },
  ];

  for (const service of services) {
    const existing = await prisma.service.findFirst({ where: { name: service.name } });
    if (!existing) {
      await prisma.service.create({ data: service });
    }
  }

  console.log('Seed concluído. Usuário admin:', admin.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
