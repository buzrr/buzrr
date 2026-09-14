import { Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { BillingWebhookService } from "./billing-webhook.service";

@Controller("billing/webhooks")
export class BillingWebhookController {
  constructor(private readonly webhooks: BillingWebhookService) {}

  /**
   * `@Public()` because the Dodo signature is the authentication. Reached via
   * the web app's `/api/webhooks/dodo` forwarder; `rawBody` is enabled in
   * `main.ts` because verification needs the exact bytes Dodo signed.
   */
  @Public()
  @Post("dodo")
  @HttpCode(HttpStatus.OK)
  dodo(@Req() req: RawBodyRequest<Request>) {
    return this.webhooks.handle(req.rawBody, req.headers);
  }
}
