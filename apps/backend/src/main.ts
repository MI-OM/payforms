import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    },
  }));

  // Enable CORS
  app.enableCors({
    origin: [
      'http://localhost:5701',
      'https://payforms.com.ng',
      'https://www.payforms.com.ng',
      /https:\/\/.*\.vercel\.app$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Payforms API')
    .setDescription('Multi-tenant payment collection platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`✓ Backend running on http://localhost:${port}`);
}

bootstrap().catch(err => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
