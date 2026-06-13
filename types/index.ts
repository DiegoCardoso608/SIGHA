import type { Perfil } from '@prisma/client'

export type UserSession = {
  id: string
  nome: string
  email: string
  perfil: Perfil
  matricula: string
}

export type ApiResponse<T = any> = {
  data?: T
  error?: string
  message?: string
}

export type DiaSemana =
  | 'SEGUNDA'
  | 'TERCA'
  | 'QUARTA'
  | 'QUINTA'
  | 'SEXTA'
  | 'SABADO'

export type Turno = 'MANHA' | 'TARDE' | 'NOITE'
