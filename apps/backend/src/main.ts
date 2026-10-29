import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { NestFactory } from "@nestjs/core";
import "dotenv/config";

async function bootstrap() {
  // `rawBody` keeps the request bytes for the Stripe webhook's signature check.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);
  // Run OnModuleDestroy (PrismaService.$disconnect) on SIGTERM/SIGINT instead of
  // dropping the DB connections mid-flight.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 5001);
}
void bootstrap();
