import { HealthController } from './health.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('returns ok health check results', async () => {
    const result = await controller.healthCheck();

    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('timestamp');
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    expect(typeof result.uptime).toBe('number');
  });

  it('returns readiness check results', async () => {
    const result = await controller.readinessCheck();

    expect(result).toEqual({
      status: 'ready',
      timestamp: expect.any(String),
    });
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });
});
