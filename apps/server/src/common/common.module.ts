import { Global, Module } from "@nestjs/common";
import { RateLimitGuard } from "./guards/rate-limit.guard";
import { RolesGuard } from "./guards/roles.guard";
import { TextGenerator } from "./llm/text-generator";
import { textGeneratorProvider } from "./llm/llm.provider";
import { RateLimitService } from "./services/rate-limit.service";
import { MediaStorage } from "./storage/media-storage";
import { storageProvider } from "./storage/storage.provider";

@Global()
@Module({
  providers: [
    RateLimitService,
    RateLimitGuard,
    RolesGuard,
    storageProvider,
    textGeneratorProvider,
  ],
  exports: [
    RateLimitService,
    RateLimitGuard,
    RolesGuard,
    MediaStorage,
    TextGenerator,
  ],
})
export class CommonModule {}
