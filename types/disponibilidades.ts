import type { DiaSemana, TipoProfessor, Titulacao, Turno } from '@prisma/client'

export interface BlocoHorarioDTO {
  id: string
  inicio: string
  fim: string
  turno: Turno
  ordem: number
}

export interface DisponibilidadeBlocoItem {
  diaSemana: DiaSemana
  blocoId: string
  disponivel: boolean
}

export interface ProfessorResumoDTO {
  id: string
  nome: string
  titulacao: Titulacao
  tipo: TipoProfessor
  cargaHorariaMax: number
}

export interface ProfessorDisponibilidadeDTO {
  professor: ProfessorResumoDTO
  blocos: BlocoHorarioDTO[]
  grade: DisponibilidadeBlocoItem[]
}

export interface AtualizarDisponibilidadeBody {
  disponibilidades: DisponibilidadeBlocoItem[]
  motivo?: string
}

export interface AtualizarDisponibilidadeResponse {
  ok: true
  total: number
  adicionados: number
  removidos: number
}

export type StatusCobertura = 'OK' | 'ATENCAO' | 'CRITICO'

export interface CoberturaItemDTO {
  diaSemana: DiaSemana
  turno: Turno
  necessario: number
  disponivelTitulares: number
  disponivelReserva: number
  cobertura: number
  status: StatusCobertura
}

export interface CoberturaResponseDTO {
  periodoLetivo: { id: string; descricao: string }
  aviso: string
  resumo: CoberturaItemDTO[]
}
