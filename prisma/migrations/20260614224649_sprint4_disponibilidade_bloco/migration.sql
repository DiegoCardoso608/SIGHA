/*
  Warnings:

  - Made the column `periodoLetivoId` on table `turmas` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TipoProfessor" AS ENUM ('TITULAR', 'SUBSTITUTO', 'RESERVA');

-- DropIndex
DROP INDEX "turmas_codigo_key";

-- AlterTable
ALTER TABLE "professores" ADD COLUMN     "tipo" "TipoProfessor" NOT NULL DEFAULT 'TITULAR';

-- AlterTable
ALTER TABLE "turmas" ALTER COLUMN "periodoLetivoId" SET NOT NULL;

-- CreateTable
CREATE TABLE "disponibilidades_bloco" (
    "id" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "blocoId" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disponibilidades_bloco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidades_bloco_professorId_blocoId_diaSemana_key" ON "disponibilidades_bloco"("professorId", "blocoId", "diaSemana");

-- AddForeignKey
ALTER TABLE "disponibilidades_bloco" ADD CONSTRAINT "disponibilidades_bloco_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "professores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidades_bloco" ADD CONSTRAINT "disponibilidades_bloco_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "blocos_horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
