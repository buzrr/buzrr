import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreatePlayerDto } from "./dto/create-player.dto";
import { UpdatePlayerNameDto } from "./dto/update-player-name.dto";

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlayerDto): Promise<{ playerId: string }> {
    const player = await this.prisma.db.player.create({
      data: {
        name: dto.username,
        profilePic: dto.profile,
      },
    });
    return { playerId: player.id };
  }

  async updateName(dto: UpdatePlayerNameDto): Promise<{ playerId: string; name: string }> {
    const cleanedName = dto.username.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30);
    if (!cleanedName) {
      throw new BadRequestException("Display name is required");
    }
    try {
      const player = await this.prisma.db.player.update({
        where: { id: dto.playerId },
        data: { name: cleanedName },
      });
      return { playerId: player.id, name: player.name };
    } catch {
      throw new NotFoundException("Player not found");
    }
  }
}
