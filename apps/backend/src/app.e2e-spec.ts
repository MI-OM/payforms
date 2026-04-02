import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
const request = require('supertest');
import { HealthModule } from './modules/health/health.module';

declare const describe: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const it: any;
declare const expect: any;

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) should return OK status', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.uptime).toBeDefined();
  });
});
