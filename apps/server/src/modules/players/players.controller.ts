import { Body, Controller, Patch, Post, UseGuards } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { CreatePlayerDto } from "./dto/create-player.dto";
import { UpdatePlayerNameDto } from "./dto/update-player-name.dto";
import { PlayersService } from "./players.service";

@Controller("players")
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @Post()
  create(@Body() dto: CreatePlayerDto) {
    return this.players.create(dto);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Patch("name")
  updateName(@Body() dto: UpdatePlayerNameDto) {
    return this.players.updateName(dto);
  }
}
