// app/api/professores/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ─── Schema de atualização ────────────────────────────────────────────────────

const atualizarProfessorSchema = z.object({
  nome: z.string().min(3).optional(),
  email: z.string().email().optional(),
  matricula: z.string().optional().nullable(),
  titulacao: z
    .enum(["GRADUADO", "ESPECIALISTA", "MESTRE", "DOUTOR", "DOUTORA", "POS_DOUTOR"])
    .optional(),
  cargaHorariaMax: z.number().int().min(1).max(40).optional(),
  ativo: z.boolean().optional(),
  novaSenha: z.string().min(6).optional(),
  disciplinaIds: z.array(z.string()).optional(),
  disponibilidades: z
    .array(
      z.object({
        diaSemana: z.enum([
          "SEGUNDA",
          "TERCA",
          "QUARTA",
          "QUINTA",
          "SEXTA",
          "SABADO",
        ]),
        turno: z.enum(["MANHA", "TARDE", "NOITE"]),
      })
    )
    .optional(),
  motivo: z.string().optional(),
});

// ─── GET /api/professores/[id] ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const professor = await prisma.professor.findUnique({
    where: { id },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
          matricula: true,
          ativo: true,
          criadoEm: true,
        },
      },
      disciplinas: {
        include: {
          disciplina: {
            select: { id: true, codigo: true, nome: true, cargaHoraria: true },
          },
        },
      },
      disponibilidades: {
        orderBy: [{ diaSemana: "asc" }, { turno: "asc" }],
      },
      _count: {
        select: { alocacoes: true },
      },
    },
  });

  if (!professor) {
    return NextResponse.json(
      { error: "Professor não encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: professor });
}

// ─── PUT /api/professores/[id] ────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = atualizarProfessorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verifica existência
  const professorExistente = await prisma.professor.findUnique({
    where: { id },
    include: { usuario: true },
  });

  if (!professorExistente) {
    return NextResponse.json(
      { error: "Professor não encontrado" },
      { status: 404 }
    );
  }

  const {
    nome,
    email,
    matricula,
    titulacao,
    cargaHorariaMax,
    ativo,
    novaSenha,
    disciplinaIds,
    disponibilidades,
    motivo,
  } = parsed.data;

  // Verifica duplicidade de e-mail (excluindo o próprio)
  if (email && email !== professorExistente.usuario.email) {
    const emailExistente = await prisma.usuario.findFirst({
      where: { email, id: { not: professorExistente.usuarioId } },
    });
    if (emailExistente) {
      return NextResponse.json(
        { error: "E-mail já está em uso por outro usuário" },
        { status: 409 }
      );
    }
  }

  // Verifica duplicidade de matrícula (excluindo o próprio)
  if (matricula && matricula !== professorExistente.usuario.matricula) {
    const matriculaExistente = await prisma.usuario.findFirst({
      where: { matricula, id: { not: professorExistente.usuarioId } },
    });
    if (matriculaExistente) {
      return NextResponse.json(
        { error: "Matrícula já está em uso por outro usuário" },
        { status: 409 }
      );
    }
  }

  const professor = await prisma.$transaction(async (tx) => {
    // Snapshot para auditoria
    const snapshot = {
      nome: professorExistente.usuario.nome,
      email: professorExistente.usuario.email,
      titulacao: professorExistente.titulacao,
      cargaHorariaMax: professorExistente.cargaHorariaMax,
      ativo: professorExistente.ativo,
    };

    // Atualiza dados do usuário
    const dadosUsuario: Record<string, unknown> = {};
    if (nome !== undefined) dadosUsuario.nome = nome;
    if (email !== undefined) dadosUsuario.email = email;
    if (matricula !== undefined) dadosUsuario.matricula = matricula;
    if (ativo !== undefined) dadosUsuario.ativo = ativo;
    if (novaSenha) dadosUsuario.senhaHash = await bcrypt.hash(novaSenha, 12);

    if (Object.keys(dadosUsuario).length > 0) {
      await tx.usuario.update({
        where: { id: professorExistente.usuarioId },
        data: dadosUsuario,
      });
    }

    // Atualiza dados do professor
    const dadosProfessor: Record<string, unknown> = {};
    if (titulacao !== undefined) dadosProfessor.titulacao = titulacao;
    if (cargaHorariaMax !== undefined)
      dadosProfessor.cargaHorariaMax = cargaHorariaMax;
    if (ativo !== undefined) dadosProfessor.ativo = ativo;

    if (Object.keys(dadosProfessor).length > 0) {
      await tx.professor.update({
        where: { id },
        data: dadosProfessor,
      });
    }

    // Atualiza disciplinas (replace completo)
    if (disciplinaIds !== undefined) {
      await tx.professorDisciplina.deleteMany({
        where: { professorId: id },
      });
      if (disciplinaIds.length > 0) {
        await tx.professorDisciplina.createMany({
          data: disciplinaIds.map((disciplinaId) => ({
            professorId: id,
            disciplinaId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Atualiza disponibilidades (replace completo)
    if (disponibilidades !== undefined) {
      await tx.disponibilidade.deleteMany({
        where: { professorId: id },
      });
      if (disponibilidades.length > 0) {
        await tx.disponibilidade.createMany({
          data: disponibilidades.map((d) => ({
            professorId: id,
            diaSemana: d.diaSemana,
            turno: d.turno,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Log de auditoria
    await tx.logAlteracao.create({
      data: {
        usuarioId: session.user.id,
        entidade: "Professor",
        entidadeId: id,
        campo: "atualizacao",
        valorAntes: JSON.stringify(snapshot),
        valorDepois: JSON.stringify({ nome, email, titulacao, cargaHorariaMax, ativo }),
        motivo: motivo ?? "Atualização de dados do professor",
      },
    });

    return tx.professor.findUnique({
      where: { id },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, matricula: true, ativo: true },
        },
        disciplinas: { include: { disciplina: true } },
        disponibilidades: true,
      },
    });
  });

  return NextResponse.json({ data: professor });
}

// ─── DELETE /api/professores/[id] (desativação lógica) ───────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const professor = await prisma.professor.findUnique({
    where: { id },
    include: { usuario: true, _count: { select: { alocacoes: true } } },
  });

  if (!professor) {
    return NextResponse.json(
      { error: "Professor não encontrado" },
      { status: 404 }
    );
  }

  // Verifica alocações ativas
  const alocacoesAtivas = await prisma.alocacao.count({
    where: {
      professorId: id,
      status: { in: ["PENDENTE", "CONFIRMADA"] },
    },
  });

  if (alocacoesAtivas > 0) {
    return NextResponse.json(
      {
        error: `Professor possui ${alocacoesAtivas} alocação(ões) ativa(s). Remova as alocações antes de desativar.`,
      },
      { status: 422 }
    );
  }

  const { motivo } = await req.json().catch(() => ({ motivo: undefined }));

  await prisma.$transaction(async (tx) => {
    await tx.professor.update({
      where: { id },
      data: { ativo: false },
    });
    await tx.usuario.update({
      where: { id: professor.usuarioId },
      data: { ativo: false },
    });
    await tx.logAlteracao.create({
      data: {
        usuarioId: session.user.id,
        entidade: "Professor",
        entidadeId: id,
        campo: "ativo",
        valorAntes: "true",
        valorDepois: "false",
        motivo: motivo ?? "Desativação do professor",
      },
    });
  });

  return NextResponse.json({ mensagem: "Professor desativado com sucesso" });
}
