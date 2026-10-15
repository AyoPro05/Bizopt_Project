import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
export async function identityTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt=0;;attempt++) {
    try { return await db.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5000,timeout:15000}); }
    catch(error) { if(attempt>=3 || !(error && typeof error === "object" && "code" in error && error.code === "P2034")) throw error; }
  }
}
export async function lockIdentity(tx: Prisma.TransactionClient,key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`identity:${key}`}, 0))`;
}
