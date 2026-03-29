import { Global, Module } from "@nestjs/common";
import { RateLimitGuard } from "./guards/rate-limit.guard";
import { RateLimitService } from "./services/rate-limit.service";
import { CloudinaryService } from "./services/cloudinary.service";

@Global()
@Module({
  providers: [RateLimitService, RateLimitGuard, CloudinaryService],
  exports: [RateLimitService, RateLimitGuard, CloudinaryService],
})
export class CommonModule {}
