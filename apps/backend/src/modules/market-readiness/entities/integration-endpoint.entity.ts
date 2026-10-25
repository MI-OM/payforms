import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type IntegrationEndpointType = 'WEBHOOK' | 'SHEETS';

@Entity('integration_endpoints')
@Index('IDX_integration_endpoints_org_active', ['organization_id', 'active'])
export class IntegrationEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', enum: ['WEBHOOK', 'SHEETS'] })
  type: IntegrationEndpointType;

  @Column({ type: 'varchar' })
  target: string;

  /**
   * Human-readable label for the endpoint.
   */
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  /**
   * Event types this endpoint subscribes to.
   * An empty list means "all events".
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  events: string[];

  @Column({ type: 'varchar' })
  secret: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}