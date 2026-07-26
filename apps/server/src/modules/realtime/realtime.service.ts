import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async removePlayer(playerId: string, gameSessionId: string) {
    const result = await this.prisma.db.player.updateMany({
      where: { id: playerId, gameId: gameSessionId },
      data: { gameId: null },
    });
    return result.count > 0;
  }

  async validateConnection(socket: {
    handshake: {
      query: Record<string, string | string[] | undefined>;
      auth?: Record<string, unknown>;
      headers?: Record<string, string | string[] | undefined>;
    };
  }) {
    const normalizeQueryValue = (
      value: string | string[] | undefined,
    ): string => {
      if (Array.isArray(value)) {
        return (value[0] ?? "").trim();
      }
      return (value ?? "").trim();
    };

    const userType = normalizeQueryValue(socket.handshake.query.userType);
    const gameCode = normalizeQueryValue(socket.handshake.query.gameCode);
    const validUserType =
      userType === "player" || userType === "admin" || userType === "duel";
    const validGameCode = /^[a-zA-Z0-9_-]{4,20}$/.test(gameCode);
    // Duel-queue connections carry no game code; everything else must.
    if (!validUserType || (!validGameCode && userType !== "duel")) {
      return { valid: false as const };
    }
    const authHeader = socket.handshake.headers?.authorization;
    const cookieHeader = socket.handshake.headers?.cookie;
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined;
    const authToken =
      (typeof socket.handshake.auth?.token === "string"
        ? socket.handshake.auth.token
        : undefined) ?? bearerToken;

    let payload: { sub?: string; typ?: string } | null = null;
    if (authToken) {
      try {
        payload = await this.jwt.verifyAsync<{ sub?: string; typ?: string }>(
          authToken,
        );
      } catch {
        return { valid: false as const, reason: "Invalid auth token" };
      }
    }

    // Duels require a logged-in account (JWT access token or session cookie);
    // there is no GameSession row — the game lives entirely in Redis.
    if (userType === "duel") {
      const userId = await this.resolveAccountUserId(payload, cookieHeader);
      if (!userId) {
        return {
          valid: false as const,
          reason: "Duel connections require a signed-in account",
        };
      }
      const user = await this.prisma.db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          image: true,
          eloRating: true,
          duelsPlayed: true,
        },
      });
      if (!user) {
        return { valid: false as const, reason: `User ${userId} not found` };
      }
      return {
        valid: true as const,
        userType: "duel" as const,
        user,
        // Empty gameCode = matchmaking-queue connection.
        gameCode: validGameCode ? gameCode : "",
        // "invite" = waiting room for a friend challenge; the gameCode is a
        // reserved invite code with no live game behind it yet.
        intent:
          normalizeQueryValue(socket.handshake.query.intent) === "invite"
            ? ("invite" as const)
            : ("queue" as const),
      };
    }

    const game = await this.prisma.db.gameSession.findUnique({
      where: { gameCode },
    });

    if (!game) {
      return { valid: false as const, reason: `Game ${gameCode} not found` };
    }

    if (userType === "player") {
      if (!payload?.sub || payload.typ !== "player") {
        return {
          valid: false as const,
          reason: "Token role mismatch for player connection",
        };
      }

      const player = await this.prisma.db.player.findUnique({
        where: { id: payload.sub },
      });

      if (!player) {
        return {
          valid: false as const,
          reason: `Player ${payload.sub} not found`,
        };
      }

      const inSession = player.gameId !== null && player.gameId === game.id;
      if (!inSession) {
        return {
          valid: false as const,
          reason: `Player ${payload.sub} is not in game ${gameCode}`,
        };
      }

      return {
        valid: true as const,
        userType: "player" as const,
        player,
        gameCode,
        gameSessionId: game.id,
        quizId: game.quizId,
        hostId: game.creatorId,
        isRoomHost: false,
      };
    }

    if (userType === "admin") {
      const adminId = await this.resolveAccountUserId(payload, cookieHeader);

      if (!adminId || payload?.typ === "player") {
        return {
          valid: false as const,
          reason: "Token role mismatch for admin connection",
        };
      }

      const admin = await this.prisma.db.user.findUnique({
        where: { id: adminId },
      });

      if (!admin) {
        return { valid: false as const, reason: `Admin ${adminId} not found` };
      }

      if (adminId !== game.creatorId) {
        return {
          valid: false as const,
          reason: `Admin ${adminId} is not the host of game ${gameCode}`,
        };
      }

      return {
        valid: true as const,
        userType: "admin" as const,
        player: null,
        gameCode,
        gameSessionId: game.id,
        quizId: game.quizId,
        hostId: game.creatorId,
        isRoomHost: true,
      };
    }

    return { valid: false as const, reason: `Invalid userType: ${userType}` };
  }

  /**
   * Resolves a signed-in account from either a verified JWT access token
   * (typ must not be "player") or the better-auth session cookie.
   */
  private async resolveAccountUserId(
    payload: { sub?: string; typ?: string } | null,
    cookieHeader: string | string[] | undefined,
  ): Promise<string | undefined> {
    if (payload?.sub && payload.typ !== "player") {
      return payload.sub;
    }
    if (typeof cookieHeader !== "string") return undefined;
    const cookies = cookieHeader
      .split(";")
      .map((cookie): [string, string] => {
        const trimmed = cookie.trim();
        const eq = trimmed.indexOf("=");
        return eq === -1
          ? [trimmed, ""]
          : [trimmed.slice(0, eq), trimmed.slice(eq + 1)];
      })
      .reduce<Record<string, string>>((acc, [key, value]) => {
        if (key && value) acc[key] = decodeURIComponent(value);
        return acc;
      }, {});
    const sessionToken =
      cookies["better-auth.session_token"] ??
      cookies["__Secure-better-auth.session_token"];
    if (!sessionToken) return undefined;
    const session = await this.prisma.db.session.findUnique({
      where: { token: sessionToken },
      select: { userId: true },
    });
    return session?.userId;
  }
}
