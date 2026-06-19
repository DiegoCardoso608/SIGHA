import type { ErroValidacaoCampo, LinhaMapeada, ResultadoValidacaoLinha } from '../types'

export function validarTurmaLinha(
  linha: LinhaMapeada,
  numeroLinha: number
): ResultadoValidacaoLinha<{
  codigo: string
  nome: string
  cursoId?: string | null
  periodoLetivoId?: string | null
  periodo: number
  turno: string
}> {
  const erros: ErroValidacaoCampo[] = []

  const codigo = normalizarTexto(linha.codigo)
  const nome = normalizarTexto(linha.nome)
  const periodo = Number(linha.periodo)
  const turno = normalizarTexto(linha.turno)

  if (!codigo) erros.push({ campo: 'codigo', mensagem: 'Código é obrigatório' })
  if (!nome) erros.push({ campo: 'nome', mensagem: 'Nome é obrigatório' })
  if (!Number.isFinite(periodo) || periodo <= 0) {
    erros.push({ campo: 'periodo', mensagem: 'Período inválido' })
  }
  if (!turno) erros.push({ campo: 'turno', mensagem: 'Turno é obrigatório' })

  if (erros.length > 0) {
    return { sucesso: false, erros }
  }

  return {
    sucesso: true,
    dados: {
      codigo,
      nome,
      cursoId: linha.cursoId ? String(linha.cursoId) : null,
      periodoLetivoId: linha.periodoLetivoId ? String(linha.periodoLetivoId) : null,
      periodo,
      turno: turno.toUpperCase(),
    },
    avisos: [],
  }
}

function normalizarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}
