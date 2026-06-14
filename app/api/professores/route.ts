// app/api/professores/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ─── Schema de criação ────────────────────────────────────────────────────────

const criarProfessorSchema = z.object({
  nome: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  matricula: z.string().optional(),
  senhaInicial: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  titulacao: z.enum([
    "GRADUADO",
    "ESPECIALISTA",
    "MESTRE",
    "DOUTOR",
    "DOUTORA",
    "POS_DOUTOR",
  ]),
  cargaHorariaMax: z.number().int().min(1).max(40),
  tipo: z.enum(["TITULAR", "SUBSTITUTO", "RESERVA"]).optional().default("TITULAR"),
  disciplinaIds: z.array(z.string()).optional().default([]),
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
    .optional()
    .default([]),
});

// ─── GET /api/professores ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const busca = searchParams.get("busca") ?? "";
  const ativo = searchParams.get("ativo");
  const titulacao = searchParams.get("titulacao");
  const pagina = Math.max(1, parseInt(searchParams.get("pagina") ?? "1"));
  const porPagina = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("porPagina") ?? "10"))
  );
  const skip = (pagina - 1) * porPagina;

  // Monta filtro dinâmico
  const where: Record<string, unknown> = {};

  if (ativo !== null && ativo !== "") {
    where.ativo = ativo === "true";
  }

  if (titulacao) {
    where.titulacao = titulacao;
  }

  if (busca) {
    where.usuario = {
      OR: [
        { nome: { contains: busca, mode: "insensitive" } },
        { email: { contains: busca, mode: "insensitive" } },
        { matricula: { contains: busca, mode: "insensitive" } },
      ],
    };
  }

  const [total, professores] = await Promise.all([
    prisma.professor.count({ where }),
    prisma.professor.findMany({
      where,
      skip,
      take: porPagina,
      orderBy: { usuario: { nome: "asc" } },
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
              select: { id: true, codigo: true, nome: true },
            },
          },
        },
        disponibilidades: {
          select: { id: true, diaSemana: true, turno: true },
          orderBy: [{ diaSemana: "asc" }, { turno: "asc" }],
        },
        _count: {
          select: { alocacoes: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: professores,
    meta: {
      total,
      pagina,
      porPagina,
      totalPaginas: Math.ceil(total / porPagina),
    },
  });
}

// ─── POST /api/professores ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = criarProfessorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    nome,
    email,
    matricula,
    senhaInicial,
    titulacao,
  cargaHorariaMax,
    tipo,
    disciplinaIds,
    disponibilidades,
  } = parsed.data;

  // Verifica duplicidade de e-mail
  const emailExistente = await prisma.usuario.findUnique({ where: { email } });
  if (emailExistente) {
    return NextResponse.json(
      { error: "E-mail já cadastrado" },
      { status: 409 }
    );
  }

  // Verifica duplicidade de matrícula
  if (matricula) {
    const matriculaExistente = await prisma.usuario.findUnique({
      where: { matricula },
    });
    if (matriculaExistente) {
      return NextResponse.json(
        { error: "Matrícula já cadastrada" },
        { status: 409 }
      );
    }
  }

  const senhaHash = await bcrypt.hash(senhaInicial, 12);

  const professor = await prisma.$transaction(async (tx) => {
    // Cria usuário
    const usuario = await tx.usuario.create({
      data: {
        nome,
        email,
        matricula: matricula || null,
        senhaHash,
        perfil: "PROFESSOR",
        ativo: true,
      },
    });

    // Cria professor vinculado
    const prof = await tx.professor.create({
      data: {
        usuarioId: usuario.id,
        titulacao,
        cargaHorariaMax,
        tipo,
        ativo: true,
      },
    });

    // Vincula disciplinas
    if (disciplinaIds.length > 0) {
      await tx.professorDisciplina.createMany({
        data: disciplinaIds.map((disciplinaId) => ({
          professorId: prof.id,
          disciplinaId,
        })),
        skipDuplicates: true,
      });
    }

    // Cadastra disponibilidades
    if (disponibilidades.length > 0) {
      await tx.disponibilidade.createMany({
        data: disponibilidades.map((d) => ({
          professorId: prof.id,
          diaSemana: d.diaSemana,
          turno: d.turno,
        })),
        skipDuplicates: true,
      });
    }

    // Log de auditoria
    await tx.logAlteracao.create({
      data: {
        usuarioId: session.user.id,
        entidade: "Professor",
        entidadeId: prof.id,
        campo: "criacao",
        valorAntes: null,
        valorDepois: JSON.stringify({ nome, email, titulacao, cargaHorariaMax, tipo }),
        motivo: "Cadastro de novo professor",
      },
    });

    return tx.professor.findUnique({
      where: { id: prof.id },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, matricula: true },
        },
        disciplinas: { include: { disciplina: true } },
        disponibilidades: true,
        disponibilidadesBloco: true,
      },
    });
  });

  return NextResponse.json({ data: professor }, { status: 201 });
}
