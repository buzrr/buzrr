import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { CreatePlayerDto } from "./dto/create-player.dto";
import { UpdatePlayerNameDto } from "./dto/update-player-name.dto";

@Injectable()
export class PlayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async create(
    dto: CreatePlayerDto,
  ): Promise<{ playerId: string; accessToken: string }> {
    const player = await this.prisma.db.player.create({
      data: {
        name: dto.username,
        profilePic: dto.profile,
      },
    });
    const accessToken = await this.jwt.signAsync({
      sub: player.id,
      typ: "player",
    });
    return { playerId: player.id, accessToken };
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

  async findById(id: string) {
    const player = await this.prisma.db.player.findUnique({
      where: { id },
    });
    if (!player) {
      throw new NotFoundException("Player not found");
    }
    return player;
  }

  async clearGameId(id: string) {
    try {
      return await this.prisma.db.player.update({
        where: { id },
        data: { gameId: null },
      });
    } catch {
      throw new NotFoundException("Player not found");
    }
  }
}
