-- Reset de usuários a pedido: mantém só Luana (ADMIN) e Teste (ADMIN), com
-- login por usuário/senha (o campo "name" já é aceito como identificador de
-- login em auth.service.ts, então "email" aqui só existe pra satisfazer a
-- coluna obrigatória/única do schema — não é mais usado na tela de login).
-- Senhas com hash bcrypt (custo 12, igual ao usado em users.service.ts).
-- Appointment.professional é obrigatório sem cascade (onDelete padrão
-- Restrict) — precisa apagar os agendamentos antes dos usuários, senão a
-- FK bloqueia o DELETE.
DELETE FROM "appointments";
DELETE FROM "users";

INSERT INTO "users" (id, name, email, "passwordHash", role, timezone, active, "createdAt", "updatedAt")
VALUES (
  '8bc8d0a9-9547-4092-9272-212b6c8c9d2d',
  'Luana',
  'luana@luanalaitart.com',
  '$2b$12$B3hAcek7DaW148YrUX5NZensZ7RCD82Dw353SJ5q1CXyVbvTrLDq6',
  'ADMIN',
  'America/Sao_Paulo',
  true,
  TIMESTAMP '2026-08-04 00:00:00',
  TIMESTAMP '2026-08-04 00:00:00'
);

INSERT INTO "users" (id, name, email, "passwordHash", role, timezone, active, "createdAt", "updatedAt")
VALUES (
  'd0ae36f9-f4db-4be3-baf2-53237337c0fb',
  'Teste',
  'teste@luanalaitart.com',
  '$2b$12$jmio5qbF4UkK1weSGmMAfeY1BZ/WdB.pvVZrhs.C9cImww6//XsGW',
  'ADMIN',
  'America/Sao_Paulo',
  true,
  TIMESTAMP '2026-08-04 00:00:01',
  TIMESTAMP '2026-08-04 00:00:01'
);
