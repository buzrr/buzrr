import { Global, Module } from "@nestjs/common";
import { RateLimitGuard } from "./guards/rate-limit.guard";
import { RolesGuard } from "./guards/roles.guard";
import { RateLimitService } from "./services/rate-limit.service";
import { CloudinaryService } from "./services/cloudinary.service";

@Global()
@Module({
  providers: [RateLimitService, RateLimitGuard, RolesGuard, CloudinaryService],
  exports: [RateLimitService, RateLimitGuard, RolesGuard, CloudinaryService],
})
export class CommonModule {}
