import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { NestFactory } from "@nestjs/core";
import "dotenv/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // Run OnModuleDestroy (PrismaService.$disconnect) on SIGTERM/SIGINT instead of
  // dropping the DB connections mid-flight.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 5001);
}
void bootstrap();
