import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Log queries in development
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  }).$extends({
    // Limit connections for serverless environment
    query: {
      async $allOperations({ operation, args, query }) {
        // Ensure we only use one connection at a time
        return query(args)
      },
    },
  })
}

const globalForPrisma = global as unknown as {
  prisma: ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
