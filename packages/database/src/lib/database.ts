import { PrismaClient } from "@prisma/client";

export function getStash() {
  return new PrismaClient({
    datasources: { db: { url: process.env.STASH_DATABASE_URL } },
  });
}

export { Prisma as Stash } from "@prisma/client";

export function getLive() {
  return new PrismaClient({
    datasources: { db: { url: process.env.LIVE_DATABASE_URL } },
  });
}

export { Prisma as Live } from "@prisma/client";
