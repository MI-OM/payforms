import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type IntegrationDeliveryStatus = 'QUEUED' | 'DELIVERED' | 'FAILED';

@Entity('integration_deliveries')
@Index('IDX_integration_deliveries_endpoint_created', ['endpoint_id', 'created_at'])
@Index('IDX_integration_deliveries_org_status', ['organization_id', 'status'])
export class IntegrationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  endpoint_id: string;

  @Column({ type: 'varchar' })
  event_type: string;

  @Column({ type: 'varchar', length: 128 })
  payload_hash: string;

  @Column({ type: 'varchar', enum: ['QUEUED', 'DELIVERED', 'FAILED'], default: 'QUEUED' })
  status: IntegrationDeliveryStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @Column({ type: 'timestamp', nullable: true })
  delivered_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}