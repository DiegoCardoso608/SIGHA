import NextAuth from 'next-auth'

console.log('DEBUG: NextAuth import', typeof NextAuth)

const handler = NextAuth({
  session: { strategy: 'jwt' },
  providers: [],
})

console.log('DEBUG: handler result', handler)
console.log('DEBUG: handler keys', Object.keys(handler))
console.log('DEBUG: handler.handlers', handler?.handlers)

export default handler
