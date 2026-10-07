import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { LOCAL_UPLOADS_ROUTE } from "./common/storage/local.storage";
import {
  localStorageConfig,
  resolveStorageDriver,
} from "./common/storage/storage.provider";
import { parseCorsOrigin } from "./common/utils/parse-cors-origin";
import { RedisIoAdapter } from "./redis/redis-io.adapter";

function applyTrustProxy(app: NestExpressApplication): void {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw || raw === "false" || raw === "0") {
    return;
  }
  if (raw === "true" || raw === "1") {
    app.set("trust proxy", 1);
    return;
  }
  const asInt = parseInt(raw, 10);
  if (!Number.isNaN(asInt) && String(asInt) === raw) {
    app.set("trust proxy", asInt);
    return;
  }
  app.set("trust proxy", raw);
}

async function bootstrap() {
  // rawBody: Dodo webhook signatures are computed over the exact request bytes
  // (billing-webhook.controller.ts); parsed JSON can't be re-serialized to them.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.enableShutdownHooks();
  applyTrustProxy(app);
  app.useWebSocketAdapter(new RedisIoAdapter(app));
  app.enableCors({
    origin: parseCorsOrigin(process.env.WEB_ORIGIN),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.setGlobalPrefix("api", { exclude: ["health"] });
  // STORAGE_DRIVER=local: the API serves the uploads it stored. Only sniffed
  // raster images ever land in the directory (local.storage.ts), and nosniff
  // keeps a browser from second-guessing their type.
  const env = (key: string) => process.env[key];
  if (resolveStorageDriver(env) === "local") {
    app.useStaticAssets(localStorageConfig(env).dir, {
      prefix: `${LOCAL_UPLOADS_ROUTE}/`,
      immutable: true,
      maxAge: "365d",
      index: false,
      dotfiles: "deny",
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      },
    });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = process.env.API_PORT ?? process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
