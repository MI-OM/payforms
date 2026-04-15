import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    service = new AuditService({} as any, {} as any);
  });

  it('formats unknown request actors as Unknown Actor instead of System', () => {
    const actor = service.formatActor({
      metadata: { raw_path: '/contacts', actor: null },
      ip_address: '127.0.0.1',
      user_agent: 'jest',
      user_id: null,
      contact_id: null,
      user: null,
      contact: null,
    } as any);

    expect(actor.name).toBe('Unknown Actor');
    expect(actor.label).toBe('Unknown Actor');
  });

  it('formats contact entities using metadata label', () => {
    const entity = service.formatEntity({
      entity_type: 'Contact',
      entity_id: 'contact-1',
      metadata: {
        entity: {
          type: 'Contact',
          id: 'contact-1',
          label: 'Ada Lovelace',
          email: 'ada@example.com',
        },
      },
    } as any);

    expect(entity).toEqual(
      expect.objectContaining({
        type: 'Contact',
        id: 'contact-1',
        label: 'Ada Lovelace',
        email: 'ada@example.com',
      }),
    );
  });

  it('falls back to entity type and id when no label metadata exists', () => {
    const entity = service.formatEntity({
      entity_type: 'Transaction',
      entity_id: 'txn-1',
      metadata: {},
    } as any);

    expect(entity.label).toBe('Transaction txn-1');
  });
});
