import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Разрешаем запросы с фронтенда (по умолчанию Nuxt dev-сервер на :3000).
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({ origin: webOrigin.split(',').map((o) => o.trim()) });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}

void bootstrap();
