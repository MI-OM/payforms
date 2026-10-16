import { ValidateIf } from 'class-validator';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const PLATFORM_PLAN_TIERS = ['free', 'starter', 'professional', 'business', 'enterprise'] as const;
export type PlatformPlanTier = (typeof PLATFORM_PLAN_TIERS)[number];

/** A positive integer, or null to clear the override (back to plan default). */
function nullablePositiveInt(example: number) {
  return {
    example,
    minimum: 1,
    nullable: true,
    description: 'Positive integer to set the limit; null clears the override (plan default applies); omit to leave unchanged.',
  };
}

/**
 * PUT /platform/organizations/:id/entitlements
 *
 * Semantics per field: number = set the negotiated limit, null = clear that
 * override, omitted = leave unchanged. `plan` optionally changes the
 * organization's billing tier in the same audited action.
 */
export class SetOrganizationEntitlementsDto {
  @ApiPropertyOptional({ enum: PLATFORM_PLAN_TIERS, description: 'Optionally change the billing tier in the same action' })
  @IsOptional()
  @IsIn(PLATFORM_PLAN_TIERS)
  plan?: PlatformPlanTier;

  @ApiPropertyOptional(nullablePositiveInt(2000))
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsInt()
  @Min(1)
  contacts_limit?: number | null;

  @ApiPropertyOptional(nullablePositiveInt(50))
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsInt()
  @Min(1)
  forms_limit?: number | null;

  @ApiPropertyOptional(nullablePositiveInt(10))
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsInt()
  @Min(1)
  staff_users_limit?: number | null;

  @ApiPropertyOptional(nullablePositiveInt(5000))
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsInt()
  @Min(1)
  monthly_submissions_limit?: number | null;

  @ApiPropertyOptional(nullablePositiveInt(5000))
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsInt()
  @Min(1)
  monthly_email_sends_limit?: number | null;

  @ApiPropertyOptional(nullablePositiveInt(50))
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsInt()
  @Min(1)
  storage_gb_limit?: number | null;

  @ApiPropertyOptional({ example: 'Negotiated annual deal — 2,000 contacts, priority support', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  notes?: string;
}
