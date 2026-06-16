-- CreateEnum
CREATE TYPE "ModalidadeDisciplina" AS ENUM ('PRESENCIAL', 'ONLINE');

-- AlterTable
ALTER TABLE "disciplinas" ADD COLUMN     "modalidade" "ModalidadeDisciplina" NOT NULL DEFAULT 'PRESENCIAL';
