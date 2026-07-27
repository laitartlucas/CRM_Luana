import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('trocar123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'consultora@example.com' },
    update: {},
    create: {
      name: 'Consultora Principal',
      email: 'consultora@example.com',
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
  ];

  for (const service of services) {
    const existing = await prisma.service.findFirst({ where: { name: service.name } });
    if (!existing) {
      await prisma.service.create({ data: service });
    }
  }

  console.log('Seed concluído. Usuário admin:', admin.email, '(senha: trocar123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
