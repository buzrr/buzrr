import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimitProfile } from "../../common/decorators/rate-limit-profile.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { BillingService } from "./billing.service";
import { ReleaseAiTokenDto, ReserveAiTokenDto } from "./dto/ai-token.dto";
import {
  CheckoutDto,
  PricingQueryDto,
  ValidateDiscountDto,
} from "./dto/pricing.dto";
import { EntitlementsService } from "./entitlements.service";
import { PricingService } from "./pricing.service";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementsService,
    private readonly pricing: PricingService,
  ) {}

  /** Plan, limits and usage for the signed-in account. */
  @Get("me")
  me(@CurrentAccountUser() user: AuthUser) {
    return this.entitlements.getEntitlements(user.userId);
  }

  /**
   * Pro price for a region plus the running promotion, read from Dodo (cached a
   * few minutes). Public so the pricing page works signed out. Display-only:
   * Dodo decides the charged amount from the billing country.
   */
  @Public()
  @Get("pricing")
  @UseGuards(RateLimitGuard)
  getPricing(@Query() query: PricingQueryDto) {
    return this.pricing.getProPricing(query.region ?? "GLOBAL");
  }

  /** Tight rate limit: stops the endpoint being used to enumerate codes. */
  @Post("discounts/validate")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimitProfile("report")
  validateDiscount(
    @CurrentAccountUser() _user: AuthUser,
    @Body() dto: ValidateDiscountDto,
  ) {
    return this.pricing.validateCode(dto.code, dto.region ?? "GLOBAL");
  }

  @Post("checkout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  checkout(@CurrentAccountUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.billing.createCheckout(user, dto.discountCode);
  }

  @Post("portal")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  portal(@CurrentAccountUser() user: AuthUser) {
    return this.billing.createPortal(user);
  }

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimitProfile("report")
  sync(@CurrentAccountUser() user: AuthUser) {
    return this.billing.syncForUser(user);
  }

  /**
   * Called by Buzrr-AI with the user's own bearer token. Reserving is harmless
   * to expose (it only spends the caller's tokens); refunding needs the release
   * token, which the AI service never hands back to the browser.
   */
  @Post("ai-tokens/reserve")
  @HttpCode(HttpStatus.OK)
  reserveAiToken(
    @CurrentAccountUser() user: AuthUser,
    @Body() dto: ReserveAiTokenDto,
  ) {
    return this.entitlements.reserveAiToken(user.userId, dto.source);
  }

  @Post("ai-tokens/release")
  @HttpCode(HttpStatus.OK)
  releaseAiToken(
    @CurrentAccountUser() user: AuthUser,
    @Body() dto: ReleaseAiTokenDto,
  ) {
    return this.entitlements.releaseAiToken(
      user.userId,
      dto.reservationId,
      dto.releaseToken,
    );
  }
}
