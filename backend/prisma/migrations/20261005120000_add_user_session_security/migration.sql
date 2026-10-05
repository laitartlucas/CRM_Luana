-- Segurança de sessão (aditiva): revogação de tokens e bloqueio por tentativas falhas.
ALTER TABLE "users"
  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- O audit log de usuários gravava a linha inteira, incluindo o hash da senha.
-- Remove esses campos dos registros já existentes (o código novo passa a omiti-los).
UPDATE "audit_logs"
SET "before" = "before" - 'passwordHash' - 'googleId',
    "after"  = "after"  - 'passwordHash' - 'googleId'
WHERE "entity" = 'user';
