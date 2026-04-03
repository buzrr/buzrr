import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";

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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  applyTrustProxy(app);
  app.useWebSocketAdapter(new IoAdapter(app));
  const origin = process.env.WEB_ORIGIN ?? true;
  app.enableCors({
    origin,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.setGlobalPrefix("api");
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
