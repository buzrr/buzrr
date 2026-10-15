import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { UpsertCategory } from "@buzrr/contract";
import { Prisma } from "@buzrr/prisma";
import { PrismaService } from "../../prisma/prisma.service";

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every category with how many questions carry it (admin view). */
  async list() {
    const rows = await this.prisma.db.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { questions: true } } },
    });
    return rows.map(({ _count, ...category }) => ({
      ...category,
      questionCount: _count.questions,
    }));
  }

  async create(dto: UpsertCategory) {
    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) throw new BadRequestException("Name needs a letter or digit");
    try {
      return await this.prisma.db.category.create({
        data: { name: dto.name, slug, hue: dto.hue ?? 270 },
      });
    } catch (err) {
      throw this.mapPrismaError(err);
    }
  }

  async update(id: string, dto: UpsertCategory) {
    try {
      return await this.prisma.db.category.update({
        where: { id },
        data: {
          name: dto.name,
          ...(dto.slug ? { slug: dto.slug } : {}),
          ...(dto.hue !== undefined ? { hue: dto.hue } : {}),
        },
      });
    } catch (err) {
      throw this.mapPrismaError(err);
    }
  }

  /** Untags questions and drops per-category ratings (cascade). */
  async remove(id: string) {
    try {
      await this.prisma.db.category.delete({ where: { id } });
    } catch (err) {
      throw this.mapPrismaError(err);
    }
  }

  /** Rejects ids that don't name a category; returns them de-duplicated. */
  async assertExist(ids: readonly string[] | undefined): Promise<string[]> {
    const unique = [...new Set(ids ?? [])];
    if (unique.length === 0) return unique;
    const found = await this.prisma.db.category.count({
      where: { id: { in: unique } },
    });
    if (found !== unique.length) {
      throw new BadRequestException("Unknown category");
    }
    return unique;
  }

  private mapPrismaError(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return new ConflictException("A category with that slug exists");
      }
      if (err.code === "P2025") {
        return new NotFoundException("Category not found");
      }
    }
    return err;
  }
}
