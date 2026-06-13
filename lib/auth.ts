import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
})

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.perfil = (user as any).perfil
        token.matricula = (user as any).matricula
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      ;(session.user as any).perfil = token.perfil
      ;(session.user as any).matricula = token.matricula
      return session
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        senha: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials)
          if (!parsed.success) return null

          // Importar Prisma aqui para evitar ciclo de dependência
          const { prisma } = await import('@/lib/prisma')

          const usuario = await prisma.usuario.findUnique({
            where: { email: parsed.data.email },
          })

          if (!usuario || !usuario.ativo) return null

          const senhaCorreta = await bcrypt.compare(
            parsed.data.senha,
            usuario.senhaHash
          )

          if (!senhaCorreta) return null

          return {
            id: usuario.id,
            email: usuario.email,
            name: usuario.nome,
            perfil: usuario.perfil,
            matricula: usuario.matricula,
            image: null,
          } as any
        } catch (error) {
          console.error('[NextAuth] Erro em authorize:', error)
          return null
        }
      },
    }),
  ],
}

