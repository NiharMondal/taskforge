import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: "*",
    credentials: true,
  });
  app.setGlobalPrefix("api/v1");
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
