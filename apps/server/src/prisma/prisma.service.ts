import { Injectable, OnModuleInit } from "@nestjs/common";
import { connectDatabase, prisma } from "@buzrr/prisma";
import type { PrismaClient } from "@buzrr/prisma";

@Injectable()
export class PrismaService implements OnModuleInit {
  get db(): PrismaClient {
    return prisma;
  }

  async onModuleInit(): Promise<void> {
    await connectDatabase();
  }
}
