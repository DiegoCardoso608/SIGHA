/*
  Warnings:

  - You are about to drop the column `email` on the `professores` table. All the data in the column will be lost.
  - You are about to drop the column `nome` on the `professores` table. All the data in the column will be lost.
  - You are about to drop the column `senhaHash` on the `professores` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "professores_email_key";

-- AlterTable
ALTER TABLE "professores" DROP COLUMN "email",
DROP COLUMN "nome",
DROP COLUMN "senhaHash";
