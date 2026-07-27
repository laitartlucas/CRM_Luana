-- Constraint de não-sobreposição de horários por profissional.
-- Prisma não expressa EXCLUDE constraints no schema.prisma, então isso é
-- aplicado manualmente após a migração inicial:
--
--   npx prisma db execute --file prisma/manual/appointment_no_overlap.sql --schema prisma/schema.prisma
--
-- Requer a extensão btree_gist (já declarada em schema.prisma via
-- `extensions = [btree_gist]`, aplicada automaticamente pelo Prisma >= 5.x
-- com o preview feature "postgresqlExtensions" — se a extensão não existir
-- ainda no banco, rode antes: CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    "professionalId" WITH =,
    tsrange("startAt", "endAt") WITH &&
  )
  WHERE (status <> 'CANCELLED');
