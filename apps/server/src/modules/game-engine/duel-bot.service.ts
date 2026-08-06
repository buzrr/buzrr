import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";

/**
 * Drives the bot opponent in a duel. The bot holds no socket: the engine asks
 * for an answer when a question opens and this fires it back through the
 * engine's normal submitAnswer path, so it is validated like a human one.
 * One timer per game — a duel only ever has one question open.
 *
 * The plan itself lives in the game's Redis meta, not here, so a restart can
 * re-arm it (see recoverTimers). An answer whose time passed while the process
 * was down fires immediately and is rejected by submitAnswer if the question's
 * deadline has since gone by.
 */
@Injectable()
export class DuelBotService implements OnApplicationShutdown {
  private readonly logger = new Logger(DuelBotService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  onApplicationShutdown(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  arm(
    gameCode: string,
    optionId: string,
    answerAt: number,
    submit: (optionId: string) => Promise<unknown>,
  ): void {
    this.cancel(gameCode);
    const timer = setTimeout(
      () => {
        this.timers.delete(gameCode);
        void submit(optionId).catch((err) =>
          this.logger.error(`Bot answer failed for ${gameCode}`, err),
        );
      },
      Math.max(0, answerAt - Date.now()),
    );
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
