import { PrismaClient, prisma } from "@buzrr/prisma";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

jest.mock("@buzrr/prisma", () => {
  const actual = jest.requireActual<typeof import("@buzrr/prisma")>("@buzrr/prisma");
  const mock = mockDeep<PrismaClient>();
  return {
    ...actual,
    prisma: mock,
    connectDatabase: jest.fn(),
  };
});

beforeEach(() => {
  mockReset(prismaMock);
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
