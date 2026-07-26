import { Inject, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../../prisma/prisma.service";
import { REDIS } from "../../redis/redis.constants";
import { GameEngineService } from "../game-engine/game-engine.service";
import type {
  DuelInviteAcceptAck,
  DuelInviteFailure,
  TypedServer,
} from "../realtime/realtime.types";
import { generateDuelInviteCode } from "./duel-code";
import { DuelQuestionsService } from "./duel-questions.service";

const INVITE_TTL_SECONDS = 15 * 60;
/** A claimed invite lingers so a losing racer reads "claimed", not "expired". */
const CLAIMED_TTL_SECONDS = 60;
const CREATE_ATTEMPTS = 5;

const inviteKey = (code: string) => `duel:invite:${code}`;
const hostIndexKey = (userId: string) => `duel:invite:host:${userId}`;

/**
 * KEYS: [invite, hostIndex, game meta]  ARGV: [ttl, code, ...field/value pairs]
 * Returns 1 created, 0 code collision (retry), -1 host already has an invite.
 *
 * The game-meta check matters because `initMeta` is HSETNX-guarded: a collision
 * there would silently no-op and run the duel on the old game's questions.
 */
const CREATE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[3]) == 1 then
  return 0
end
if not redis.call('SET', KEYS[2], ARGV[2], 'NX', 'EX', ARGV[1]) then
  return -1
end
redis.call('HSET', KEYS[1], unpack(ARGV, 3))
redis.call('EXPIRE', KEYS[1], ARGV[1])
return 1
`;

/**
 * KEYS: [invite, hostIndex]  ARGV: [guestId, now, claimedTtl, code]
 * Returns {0} gone, {1} already claimed, {3} self-claim, {2, ...hash} claimed.
 *
 * The EXISTS guard is load-bearing: a bare HSETNX on an expired invite would
 * create the hash, report a win on a dead invite, and leave it with no TTL.
 */
const CLAIM_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return {0} end
if redis.call('HGET', KEYS[1], 'hostId') == ARGV[1] then return {3} end
if redis.call('HSETNX', KEYS[1], 'claimedBy', ARGV[1]) == 0 then return {1} end
redis.call('HSET', KEYS[1], 'claimedAt', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
if redis.call('GET', KEYS[2]) == ARGV[4] then redis.call('DEL', KEYS[2]) end
local h = redis.call('HGETALL', KEYS[1])
table.insert(h, 1, 2)
return h
`;

/**
 * Undoes a claim when startDuel throws, so the guest can retry.
 * KEYS: [invite, hostIndex]  ARGV: [remainingTtl, code]
 */
const RELEASE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('HDEL', KEYS[1], 'claimedBy', 'claimedAt')
redis.call('EXPIRE', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[2], 'NX', 'EX', ARGV[1])
return 1
`;

/**
 * KEYS: [invite, hostIndex]  ARGV: [hostId]
 * Returns 1 cancelled, 0 not the host / gone, 2 already accepted.
 */
const CANCEL_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
if redis.call('HGET', KEYS[1], 'hostId') ~= ARGV[1] then return 0 end
if redis.call('HEXISTS', KEYS[1], 'claimedBy') == 1 then return 2 end
redis.call('DEL', KEYS[1])
redis.call('DEL', KEYS[2])
return 1
`;

interface InviteRecord {
  hostId: string;
  hostName: string;
  hostImage: string;
  hostElo: string;
  createdAt: string;
  expiresAt: string;
  claimedBy?: string;
  claimedAt?: string;
}

export interface DuelInviteView {
  code: string;
  host: { id: string; name: string; image: string | null; elo: number };
  expiresAt: number;
  status: "pending" | "claimed";
  isHost: boolean;
  /** True when the viewer is the guest who claimed this invite. */
  isClaimer: boolean;
  hostOnline: boolean;
}

export type CancelOutcome = "cancelled" | "forbidden" | "claimed";

/**
 * Friend-challenge duels. A pending invite is a pre-game record: it reserves a
 * code and nothing else. The guest's accept hands that same code to
 * `GameEngineService.startDuel`, so an invited duel reuses the matchmade path.
 */
@Injectable()
export class DuelInviteService {
  private readonly logger = new Logger(DuelInviteService.name);
  private io: TypedServer | null = null;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly questions: DuelQuestionsService,
    private readonly engine: GameEngineService,
  ) {}

  setServer(io: TypedServer): void {
    this.io = io;
  }

  /** Mints a code, or returns the host's existing pending invite. */
  async create(user: {
    id: string;
    name: string | null;
    image: string | null;
    elo: number;
  }): Promise<{ code: string; expiresAt: number }> {
    const existing = await this.redis.get(hostIndexKey(user.id));
    if (existing) {
      const record = await this.read(existing);
      if (record && !record.claimedBy) {
        return { code: existing, expiresAt: Number(record.expiresAt) };
      }
    }

    const now = Date.now();
    const expiresAt = now + INVITE_TTL_SECONDS * 1000;

    for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
      const code = generateDuelInviteCode();
      const result = (await this.redis.eval(
        CREATE_SCRIPT,
        3,
        inviteKey(code),
        hostIndexKey(user.id),
        `game:${code}:meta`,
        String(INVITE_TTL_SECONDS),
        code,
        "hostId",
        user.id,
        "hostName",
        user.name ?? "Player",
        "hostImage",
        user.image ?? "",
        "hostElo",
        String(user.elo),
        "createdAt",
        String(now),
        "expiresAt",
        String(expiresAt),
      )) as number;

      if (result === 1) {
        this.logger.log(`Duel invite ${code} created by ${user.id}`);
        return { code, expiresAt };
      }
      if (result === -1) {
        // Lost a race with a concurrent create — reuse whichever won.
        const winner = await this.redis.get(hostIndexKey(user.id));
        const record = winner ? await this.read(winner) : null;
        if (winner && record) {
          return { code: winner, expiresAt: Number(record.expiresAt) };
        }
      }
    }

    throw new Error("Could not allocate a duel invite code");
  }

  async get(code: string, viewerId: string): Promise<DuelInviteView | null> {
    const record = await this.read(code);
    if (!record) return null;
    const presence = await this.presence(record.hostId);
    return {
      code,
      host: {
        id: record.hostId,
        name: record.hostName,
        image: record.hostImage || null,
        elo: Number(record.hostElo),
      },
      expiresAt: Number(record.expiresAt),
      status: record.claimedBy ? "claimed" : "pending",
      isHost: record.hostId === viewerId,
      isClaimer: Boolean(record.claimedBy) && record.claimedBy === viewerId,
      hostOnline: presence.waitingOn.includes(code),
    };
  }

  async cancel(code: string, hostId: string): Promise<CancelOutcome> {
    const result = (await this.redis.eval(
      CANCEL_SCRIPT,
      2,
      inviteKey(code),
      hostIndexKey(hostId),
      hostId,
    )) as number;
    if (result === 1) return "cancelled";
    if (result === 2) return "claimed";
    return "forbidden";
  }

  /**
   * The guest claims the invite and both players drop into a live duel.
   *
   * Presence and question-building run *before* the claim, so a missing host or
   * an empty question pool leaves the invite reusable instead of burning it.
   */
  async accept(
    code: string,
    guest: { id: string; name: string; image: string | null; elo: number },
  ): Promise<DuelInviteAcceptAck> {
    const guestPresence = await this.presence(guest.id);
    if (guestPresence.inLiveDuel) return fail("busy");

    const record = await this.read(code);
    if (!record) return fail("not-found");
    if (record.hostId === guest.id) return fail("self");
    if (record.claimedBy) return fail("claimed");

    // Without a live host socket the host misses `duel:matched`, yet the duel
    // starts anyway on its countdown and forfeits them 30s later.
    const hostPresence = await this.presence(record.hostId);
    if (!hostPresence.waitingOn.includes(code)) return fail("host-offline");
    if (hostPresence.inLiveDuel) return fail("busy");

    let questions;
    try {
      questions = await this.questions.build();
    } catch (err) {
      this.logger.error("Failed to build duel question set", err);
      return fail("no-questions");
    }

    const claim = (await this.redis.eval(
      CLAIM_SCRIPT,
      2,
      inviteKey(code),
      hostIndexKey(record.hostId),
      guest.id,
      String(Date.now()),
      String(CLAIMED_TTL_SECONDS),
      code,
    )) as [number, ...string[]];

    const status = Number(claim[0]);
    if (status === 0) return fail("not-found");
    if (status === 1) return fail("claimed");
    if (status === 3) return fail("self");

    // Re-read both accounts: the invite snapshot can be 15 minutes stale.
    const users = await this.prisma.db.user.findMany({
      where: { id: { in: [record.hostId, guest.id] } },
      select: { id: true, name: true, image: true, eloRating: true },
    });
    const hostUser = users.find((u) => u.id === record.hostId);
    const guestUser = users.find((u) => u.id === guest.id);

    const host = {
      id: record.hostId,
      name: hostUser?.name ?? record.hostName,
      image: hostUser?.image ?? (record.hostImage || null),
      elo: hostUser?.eloRating ?? Number(record.hostElo),
    };
    const challenger = {
      id: guest.id,
      name: guestUser?.name ?? guest.name,
      image: guestUser?.image ?? guest.image,
      elo: guestUser?.eloRating ?? guest.elo,
    };

    try {
      await this.engine.startDuel(
        code,
        [host, challenger].map((p) => ({
          id: p.id,
          name: p.name,
          profilePic: p.image,
          userId: p.id,
        })),
        questions,
        { rated: false },
      );
    } catch (err) {
      this.logger.error(`Failed to start invited duel ${code}`, err);
      await this.release(code, record).catch((releaseErr) =>
        this.logger.error(`Failed to release invite ${code}`, releaseErr),
      );
      return fail("error");
    }

    this.io?.to(`player:${host.id}`).emit("duel:matched", {
      gameCode: code,
      opponent: {
        id: challenger.id,
        name: challenger.name,
        profilePic: challenger.image,
        elo: challenger.elo,
      },
    });
    this.io?.to(`player:${challenger.id}`).emit("duel:matched", {
      gameCode: code,
      opponent: {
        id: host.id,
        name: host.name,
        profilePic: host.image,
        elo: host.elo,
      },
    });
    this.logger.log(
      `Invited duel ${code}: ${host.id} vs ${challenger.id} (unrated)`,
    );

    return { ok: true, gameCode: code };
  }

  private async read(code: string): Promise<InviteRecord | null> {
    const raw = await this.redis.hgetall(inviteKey(code));
    if (!raw || Object.keys(raw).length === 0) return null;
    return raw as unknown as InviteRecord;
  }

  private async release(code: string, record: InviteRecord): Promise<void> {
    const remaining = Math.max(
      1,
      Math.floor((Number(record.expiresAt) - Date.now()) / 1000),
    );
    await this.redis.eval(
      RELEASE_SCRIPT,
      2,
      inviteKey(code),
      hostIndexKey(record.hostId),
      String(remaining),
      code,
    );
  }

  /**
   * Live presence off the socket adapter rather than a stored flag, which would
   * need a disconnect handler that rots on an instance SIGKILL — exactly when
   * the host is most offline. `player:{userId}` also holds game sockets, so
   * `duelInviteCode` is what proves a socket is open for *this* invite.
   */
  private async presence(
    userId: string,
  ): Promise<{ waitingOn: string[]; inLiveDuel: boolean }> {
    if (!this.io) return { waitingOn: [], inLiveDuel: false };
    try {
      const sockets = await this.io.in(`player:${userId}`).fetchSockets();
      return {
        waitingOn: sockets
          .map((s) => s.data?.duelInviteCode)
          .filter((c): c is string => Boolean(c)),
        inLiveDuel: sockets.some(
          (s) => Boolean(s.data?.gameCode) && s.data?.playerId === userId,
        ),
      };
    } catch (err) {
      // Fail closed: a false "absent" costs a retry click, a false "present"
      // silently forfeits the host.
      this.logger.error(`Presence lookup failed for ${userId}`, err);
      return { waitingOn: [], inLiveDuel: false };
    }
  }
}

function fail(reason: DuelInviteFailure): DuelInviteAcceptAck {
  return { ok: false, reason };
}
