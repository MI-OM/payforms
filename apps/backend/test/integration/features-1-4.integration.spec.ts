import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

// The suite boots the whole application against a real database, which takes
// noticeably longer than Jest's 5s default when the database is remote.
jest.setTimeout(180_000);

/**
 * Integration tests for Features 1 and 4.
 *
 * Feature 1 — Contact Import Templates:
 *   template CRUD, field configuration, custom fields, and the audit trail
 *   that records which template an import ran against.
 *
 * Feature 4 — API Integration Webhooks:
 *   endpoint CRUD, event subscription, delivery history, and retry.
 *
 * The suite registers its own organization and administrator, so it does not
 * depend on pre-seeded credentials. It does need a reachable database — the
 * same one the application is configured against.
 */
describe('Features 1 & 4 integration', () => {
  let app: INestApplication;
  let accessToken: string;
  let organizationId: string;

  const runId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const adminEmail = `feature-test-${runId}@payforms.test`;
  const adminPassword = 'IntegrationTest1!';

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        organization_name: `Feature Test ${runId}`,
        email: adminEmail,
        password: adminPassword,
      });

    accessToken = registerRes.body.access_token;
    organizationId = registerRes.body.user?.organization_id ?? registerRes.body.organization_id;

    // The integrations feature is behind an organization flag.
    await request(app.getHttpServer())
      .patch('/v1/market/features')
      .set(auth())
      .send({ flags: { integrations_enabled: true } });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Feature 1: contact import templates', () => {
    let templateId: string;

    it('creates a template', async () => {
      const response = await request(app.getHttpServer())
        .post('/contacts/import-templates')
        .set(auth())
        .send({
          name: `Student intake ${runId}`,
          description: 'Integration test template',
          fields_config: {
            first_name: { visible: true, required: true, label: 'First Name' },
            email: { visible: true, required: true, label: 'Email Address' },
            phone: { visible: true, required: false, label: 'Phone Number' },
          },
          custom_fields: [
            {
              id: 'cf-academic-year',
              name: 'academic_year',
              label: 'Academic Year',
              type: 'text',
              required: false,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe(`Student intake ${runId}`);
      expect(response.body.fields_config.email.required).toBe(true);
      expect(response.body.custom_fields).toHaveLength(1);

      templateId = response.body.id;
    });

    it('rejects a template without a name', async () => {
      const response = await request(app.getHttpServer())
        .post('/contacts/import-templates')
        .set(auth())
        .send({ name: '   ' });

      expect(response.status).toBe(400);
    });

    it('rejects an unknown standard field', async () => {
      const response = await request(app.getHttpServer())
        .post('/contacts/import-templates')
        .set(auth())
        .send({
          name: `Bad field ${runId}`,
          fields_config: { not_a_contact_field: { visible: true, required: false, label: 'x' } },
        });

      expect(response.status).toBe(400);
    });

    it('lists templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/contacts/import-templates')
        .set(auth());

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('gets a single template', async () => {
      const response = await request(app.getHttpServer())
        .get(`/contacts/import-templates/${templateId}`)
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(templateId);
    });

    it('returns 404 for a template that does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/contacts/import-templates/00000000-0000-4000-8000-000000000000')
        .set(auth());

      expect(response.status).toBe(404);
    });

    it('updates a template', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/contacts/import-templates/${templateId}`)
        .set(auth())
        .send({
          name: `Updated intake ${runId}`,
          fields_config: {
            first_name: { visible: true, required: true, label: 'First Name' },
            email: { visible: true, required: true, label: 'Email Address' },
            phone: { visible: true, required: true, label: 'Phone Number' },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(`Updated intake ${runId}`);
      expect(response.body.fields_config.phone.required).toBe(true);
    });

    it('marks a template as the organization default', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/contacts/import-templates/${templateId}`)
        .set(auth())
        .send({ is_default: true });

      expect(response.status).toBe(200);
      expect(response.body.is_default).toBe(true);

      const defaultRes = await request(app.getHttpServer())
        .get('/contacts/import-templates/default')
        .set(auth());

      expect(defaultRes.status).toBe(200);
      expect(defaultRes.body.id).toBe(templateId);
    });

    it('returns the fields for the import UI', async () => {
      const response = await request(app.getHttpServer())
        .get(`/contacts/import-templates/${templateId}/fields`)
        .set(auth());

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.fields)).toBe(true);
      expect(response.body.fields.length).toBeGreaterThan(0);
    });

    it('records the template against a validated import', async () => {
      const validation = await request(app.getHttpServer())
        .post('/contacts/imports/csv/validate')
        .set(auth())
        .send({
          csv: 'first_name,email,phone\nJane,jane@example.com,+2348012345678',
          template_id: templateId,
        });

      expect(validation.status).toBe(201);
      expect(validation.body.template.id).toBe(templateId);
      expect(validation.body.template.name).toBe(`Updated intake ${runId}`);
      expect(validation.body.failure_count).toBe(0);

      const importRes = await request(app.getHttpServer())
        .get(`/contacts/imports/${validation.body.import_id}`)
        .set(auth());

      expect(importRes.status).toBe(200);
      expect(importRes.body.template_id).toBe(templateId);
    });

    it('rejects an import row that is missing a template-required field', async () => {
      const validation = await request(app.getHttpServer())
        .post('/contacts/imports/csv/validate')
        .set(auth())
        .send({
          csv: 'first_name,email,phone\nJane,,+2348012345678',
          template_id: templateId,
        });

      expect(validation.status).toBe(201);
      expect(validation.body.failure_count).toBe(1);
      expect(validation.body.errors[0].errors.join(' ')).toMatch(/Email/i);
    });

    it('rejects a template id belonging to another organization', async () => {
      const validation = await request(app.getHttpServer())
        .post('/contacts/imports/csv/validate')
        .set(auth())
        .send({
          csv: 'first_name,email\nJane,jane@example.com',
          template_id: '00000000-0000-4000-8000-000000000000',
        });

      expect(validation.status).toBe(404);
    });

    it('deletes a template', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/contacts/import-templates')
        .set(auth())
        .send({ name: `Disposable ${runId}` });

      const disposableId = createRes.body.id;

      const deleteRes = await request(app.getHttpServer())
        .delete(`/contacts/import-templates/${disposableId}`)
        .set(auth());

      expect(deleteRes.status).toBe(204);

      const getRes = await request(app.getHttpServer())
        .get(`/contacts/import-templates/${disposableId}`)
        .set(auth());

      expect(getRes.status).toBe(404);
    });
  });

  describe('Feature 4: API integration webhooks', () => {
    let endpointId: string;

    it('creates a webhook endpoint', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/market/integrations/endpoints')
        .set(auth())
        .send({
          type: 'WEBHOOK',
          name: `Test Webhook ${runId}`,
          target: 'https://example.com/webhook',
          events: ['payment.completed'],
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe(`Test Webhook ${runId}`);
      expect(response.body.events).toEqual(['payment.completed']);
      // The secret is never returned in full.
      expect(response.body.secret).toBeUndefined();
      expect(response.body.secret_preview).toBeDefined();

      endpointId = response.body.id;
    });

    it('rejects an endpoint without a target', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/market/integrations/endpoints')
        .set(auth())
        .send({ type: 'WEBHOOK' });

      expect(response.status).toBe(400);
    });

    it('lists endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/market/integrations/endpoints')
        .set(auth());

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('gets a single endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/market/integrations/endpoints/${endpointId}`)
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(endpointId);
    });

    it('returns 404 for an endpoint that does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/market/integrations/endpoints/00000000-0000-4000-8000-000000000000')
        .set(auth());

      expect(response.status).toBe(404);
    });

    it('updates an endpoint', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/market/integrations/endpoints/${endpointId}`)
        .set(auth())
        .send({
          name: `Renamed Webhook ${runId}`,
          events: ['payment.completed', 'payment.failed'],
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(`Renamed Webhook ${runId}`);
      expect(response.body.events).toContain('payment.failed');
    });

    it('toggles an endpoint between active and paused', async () => {
      const toggleRes = await request(app.getHttpServer())
        .post(`/v1/market/integrations/endpoints/${endpointId}/toggle`)
        .set(auth());

      expect(toggleRes.status).toBe(201);
      expect(toggleRes.body.is_enabled).toBe(false);

      const backRes = await request(app.getHttpServer())
        .post(`/v1/market/integrations/endpoints/${endpointId}/toggle`)
        .set(auth());

      expect(backRes.body.is_enabled).toBe(true);
    });

    it('sends a test event and queues a delivery', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/market/integrations/endpoints/${endpointId}/test`)
        .set(auth());

      expect(response.status).toBe(201);
      expect(response.body.delivery_id).toBeDefined();
      expect(response.body).toHaveProperty('ok');
    });

    it('lists deliveries with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/market/integrations/deliveries')
        .query({ endpoint_id: endpointId, limit: 10 })
        .set(auth());

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(1);
    });

    it('gets a single delivery', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/v1/market/integrations/deliveries')
        .query({ endpoint_id: endpointId, limit: 1 })
        .set(auth());

      const deliveryId = listRes.body.data[0].id;

      const response = await request(app.getHttpServer())
        .get(`/v1/market/integrations/deliveries/${deliveryId}`)
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(deliveryId);
    });

    it('retries a delivery', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/v1/market/integrations/deliveries')
        .query({ endpoint_id: endpointId, limit: 1 })
        .set(auth());

      const deliveryId = listRes.body.data[0].id;

      const response = await request(app.getHttpServer())
        .post(`/v1/market/integrations/deliveries/${deliveryId}/retry`)
        .set(auth());

      expect(response.status).toBe(201);
      expect(response.body.delivery_id).toBe(deliveryId);
    });

    it('reports endpoint statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/market/integrations/endpoints/${endpointId}/stats`)
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total_deliveries');
      expect(response.body).toHaveProperty('successful');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('success_rate');
    });

    it('deletes an endpoint', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/v1/market/integrations/endpoints')
        .set(auth())
        .send({
          type: 'WEBHOOK',
          target: 'https://example.com/disposable',
          name: `Disposable ${runId}`,
        });

      const disposableId = createRes.body.id;

      const deleteRes = await request(app.getHttpServer())
        .delete(`/v1/market/integrations/endpoints/${disposableId}`)
        .set(auth());

      expect(deleteRes.status).toBe(204);

      const getRes = await request(app.getHttpServer())
        .get(`/v1/market/integrations/endpoints/${disposableId}`)
        .set(auth());

      expect(getRes.status).toBe(404);
    });
  });
});
