import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { BotTier, planBotAnswer } from "../../common/utils/duel-bot";
import type { LiveQuestion } from "./game-engine.types";

/**
 * Drives the bot opponent in a duel. The bot holds no socket: the engine asks
 * for an answer when a question opens and this fires it back through the
 * engine's normal submitAnswer path, so it is validated like a human one.
 * One timer per game — a duel only ever has one question open.
 */
@Injectable()
export class DuelBotService implements OnApplicationShutdown {
  private readonly logger = new Logger(DuelBotService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  onApplicationShutdown(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  schedule(
    gameCode: string,
    tier: BotTier,
    question: LiveQuestion,
    submit: (optionId: string) => Promise<unknown>,
  ): void {
    this.cancel(gameCode);
    const { optionId, delayMs } = planBotAnswer(question, tier);
    const timer = setTimeout(() => {
      this.timers.delete(gameCode);
      void submit(optionId).catch((err) =>
        this.logger.error(`Bot answer failed for ${gameCode}`, err),
      );
    }, delayMs);
    timer.unref();
    this.timers.set(gameCode, timer);
  }

  cancel(gameCode: string): void {
    const timer = this.timers.get(gameCode);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(gameCode);
  }
}
