import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add it to apps/server/.env (e.g. DATABASE_URL=postgresql://user:pass@localhost:5432/buzrr)"
  )
}

const adapter = new PrismaPg({ connectionString })
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 2000

export async function connectDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.$connect()
      console.log("Database connected")
      return
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(
        `Database connection attempt ${attempt}/${MAX_RETRIES} failed:`,
        message
      )
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Could not connect to database after ${MAX_RETRIES} attempts. ` +
            "Ensure PostgreSQL is running and DATABASE_URL in apps/server/.env is correct (e.g. postgresql://user:pass@localhost:5432/buzrr)."
        )
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
  }
}