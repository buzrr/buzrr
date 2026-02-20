import { PrismaClient, prisma } from "@buzrr/prisma";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

jest.mock("@buzrr/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
  connectDatabase: jest.fn(),
}));

beforeEach(() => {
  mockReset(prismaMock);
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
