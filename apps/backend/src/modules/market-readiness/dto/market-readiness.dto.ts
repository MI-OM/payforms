import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMarketReadinessFlagsDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: {
      checkout_v2_enabled: true,
      abandoned_recovery_enabled: false,
    },
  })
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => (value && typeof value === 'object' ? value : {}))
  flags?: Record<string, boolean>;
}

export class CreateCheckoutSessionDto {
  @ApiPropertyOptional({ example: 'form-uuid' })
  @IsOptional()
  @IsUUID()
  form_id?: string;

  @ApiPropertyOptional({ example: 'contact-uuid' })
  @IsOptional()
  @IsUUID()
  contact_id?: string;

  @ApiPropertyOptional({ example: 'REF-12345' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class UpdateCheckoutSessionDto {
  @ApiPropertyOptional({ example: 'COMPLETED' })
  @IsOptional()
  @IsIn(['STARTED', 'FAILED', 'COMPLETED', 'ABANDONED'])
  status?: 'STARTED' | 'FAILED' | 'COMPLETED' | 'ABANDONED';
}

export class RecoveryRunDto {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;
}

export class InstallmentPlanItemInputDto {
  @IsString()
  label: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  due_date: string;

  @IsOptional()
  @IsObject()
  penalty_rule?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  order_index?: number;
}

export class CreateInstallmentPlanDto {
  @IsUUID()
  form_id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  @Min(0)
  total_amount: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallmentPlanItemInputDto)
  items: InstallmentPlanItemInputDto[];
}

export class UpdateInstallmentPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_amount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallmentPlanItemInputDto)
  items?: InstallmentPlanItemInputDto[];
}

export class AssignInstallmentContactsDto {
  @IsArray()
  @IsUUID('all', { each: true })
  contact_ids: string[];
}

export class CreateReconciliationRunDto {
  @IsOptional()
  @IsDateString()
  period_start?: string;

  @IsOptional()
  @IsDateString()
  period_end?: string;
}

export class UpdateReconciliationExceptionDto {
  @IsIn(['OPEN', 'RESOLVED', 'IGNORED'])
  status: 'OPEN' | 'RESOLVED' | 'IGNORED';

  @IsOptional()
  @IsString()
  resolution_note?: string;
}

export class CreateIntegrationEndpointDto {
  @IsIn(['WEBHOOK', 'SHEETS'])
  type: 'WEBHOOK' | 'SHEETS';

  @IsString()
  target: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateIntegrationEndpointDto {
  @IsOptional()
  @IsString()
  target?: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreatePartnerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class OnboardPartnerOrganizationDto {
  @IsUUID()
  tenant_organization_id: string;

  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'PAUSED'])
  onboarding_status?: 'PENDING' | 'ACTIVE' | 'PAUSED';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateDunningCampaignDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'])
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_days_overdue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_days_overdue?: number;

  @IsOptional()
  @IsString()
  min_outstanding_amount?: string;

  @IsOptional()
  @IsObject()
  escalation_rules?: Record<string, any>;

  @IsOptional()
  @IsObject()
  filter_criteria?: Record<string, any>;

  @IsOptional()
  @IsIn(['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY'])
  execution_frequency?: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

export class UpdateDunningCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'])
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_days_overdue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_days_overdue?: number;

  @IsOptional()
  @IsString()
  min_outstanding_amount?: string;

  @IsOptional()
  @IsObject()
  escalation_rules?: Record<string, any>;

  @IsOptional()
  @IsObject()
  filter_criteria?: Record<string, any>;

  @IsOptional()
  @IsIn(['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY'])
  execution_frequency?: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

export class RunDunningCampaignDto {
  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;

  @IsOptional()
  @IsDateString()
  scheduled_for?: string;
}

export class CreateComplianceExportPackDto {
  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  request_reason?: string;
}
