import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';

const JSON_BODY_LIMIT = '1mb';

async function bootstrap() {
  // Отключаем встроенный body-parser Nest, чтобы задать свой лимит размера JSON-тела
  // ниже, вместо неограниченного дефолта.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // API отдаёт JSON и файлы (аватары/файлы встреч) на отдельном origin от фронтенда
  // (см. `enableCors` ниже) — CSP не защищает чистый API, а дефолтный CORP заблокировал
  // бы кросс-origin `<img src>`/скачивание с фронтенда.
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }),
  );
  app.use(json({ limit: JSON_BODY_LIMIT }));

  // Разрешаем запросы с фронтенда (по умолчанию Nuxt dev-сервер на :3000).
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({
    origin: webOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}

void bootstrap();
