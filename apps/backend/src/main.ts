import * as express from 'express';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const tenantBaseDomain = (process.env.TENANT_BASE_DOMAIN || '').trim().toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';
  const swaggerEnabled = process.env.ENABLE_SWAGGER === 'true' || !isProduction;
  const appBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const frontendOrigin = new URL(appBaseUrl).origin;

  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    },
  }));
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.paystack.co'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", frontendOrigin, 'https://api.paystack.co', 'https://checkout.paystack.com'],
        frameSrc: ["'self'", 'https://js.paystack.co', 'https://checkout.paystack.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", frontendOrigin, 'https://checkout.paystack.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  }));

  // Enable CORS
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isLocalhostOrigin = /^http:\/\/localhost:(3000|5173|5701)$/.test(origin);
      const isVercelPreview = /^https:\/\/.*\.vercel\.app$/.test(origin);
      const isTenantBaseDomainOrigin =
        !!tenantBaseDomain &&
        new RegExp(`^https?:\\/\\/([a-z0-9-]+\\.)*${tenantBaseDomain.replace(/\./g, '\\.')}$`, 'i').test(origin);

      if (isLocalhostOrigin || isVercelPreview || isTenantBaseDomainOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Payforms API')
    .setDescription('Multi-tenant payment collection platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`✓ Backend running on http://localhost:${port}`);
}

bootstrap().catch(err => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
