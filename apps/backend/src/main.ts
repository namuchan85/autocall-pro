import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppLoggerService } from './common/logger/app-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  if (config.getOrThrow<boolean>('TRUST_PROXY')) {
    app.set('trust proxy', config.getOrThrow<number>('TRUST_PROXY_HOPS'));
  }

  app.useLogger(app.get(AppLoggerService));
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_URL'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AutoCall Lite API')
    .setDescription('Personal autocall REST API')
    .setVersion('0.5.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token from POST /auth/login',
      },
      'JWT',
    )
    .addCookieAuth('refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'refresh_token',
    })
    .build();
  SwaggerModule.setup('swagger', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('PORT', 3001);
  await app.listen(port, '127.0.0.1');
  Logger.log(`Backend listening on 127.0.0.1:${port}`, 'Bootstrap');
}

void bootstrap();
