import type { ErroValidacaoCampo, LinhaMapeada, ResultadoValidacaoLinha } from '../types'

export function validarProfessorLinha(
  linha: LinhaMapeada,
  numeroLinha: number
): ResultadoValidacaoLinha<{
  nome: string
  email: string
  matricula?: string | null
  titulacao: string
  cargaHorariaMax: number
  tipo: string
  disciplinaIds?: string[]
}> {
  const erros: ErroValidacaoCampo[] = []

  const nome = normalizarTexto(linha.nome)
  const email = normalizarTexto(linha.email)
  const titulacao = normalizarTexto(linha.titulacao)
  const cargaHoraria = Number(linha.cargaHorariaMax)

  if (!nome) erros.push({ campo: 'nome', mensagem: 'Nome é obrigatório' })
  if (!email) erros.push({ campo: 'email', mensagem: 'E-mail é obrigatório' })
  if (!titulacao) erros.push({ campo: 'titulacao', mensagem: 'Titulação é obrigatória' })
  if (!Number.isFinite(cargaHoraria) || cargaHoraria <= 0) {
    erros.push({ campo: 'cargaHorariaMax', mensagem: 'Carga horária máxima inválida' })
  }

  if (erros.length > 0) {
    return { sucesso: false, erros }
  }

  return {
    sucesso: true,
    dados: {
      nome,
      email,
      matricula: linha.matricula ? String(linha.matricula).trim() || null : null,
      titulacao: titulacao.toUpperCase(),
      cargaHorariaMax: cargaHoraria,
      tipo: linha.tipo ? String(linha.tipo).toUpperCase() : 'TITULAR',
      disciplinaIds: Array.isArray(linha.disciplinaIds)
        ? linha.disciplinaIds.map((v) => String(v))
        : [],
    },
    avisos: [],
  }
}

function normalizarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}
