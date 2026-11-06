import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { LoggerService } from './logging/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);

  app.useLogger(logger);

  app.setGlobalPrefix(`api/${configService.get('app.apiVersion')}`, {
    exclude: ['health'],
  });

  app.use(helmet.default());
  app.use(cookieParser());

  app.enableCors({
    origin: (configService.get<string>('app.corsOrigin') || '').split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS API - Skeleton')
    .setDescription('API REST con autenticación OAuth2/PKCE, RBAC y más')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa tu access token JWT',
        in: 'header',
      },
      'JWT-auth',
    )
    .addSecurityRequirements('JWT-auth')
    .addTag('Autenticación', 'Endpoints de autenticación y OAuth2')
    .addTag('Usuarios', 'Gestión de usuarios (solo admin)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  logger.log(`🚀 API corriendo en http://localhost:${port}/api/${configService.get('app.apiVersion')}`);
  logger.log(`📚 Documentación Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
