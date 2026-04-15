import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { MarketReadinessController } from './controllers/market-readiness.controller';
import { MarketReadinessService } from './market-readiness.service';
import { CheckoutSession } from './entities/checkout-session.entity';
import { PaymentRecoveryCandidate } from './entities/payment-recovery-candidate.entity';
import { PaymentRecoveryEvent } from './entities/payment-recovery-event.entity';
import { Payment } from '../payment/entities/payment.entity';
import { InstallmentPlan } from './entities/installment-plan.entity';
import { InstallmentPlanItem } from './entities/installment-plan-item.entity';
import { ContactInstallmentAccount } from './entities/contact-installment-account.entity';
import { Form } from '../form/entities/form.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Submission } from '../submission/entities/submission.entity';
import { ReconciliationRun } from './entities/reconciliation-run.entity';
import { ReconciliationException } from './entities/reconciliation-exception.entity';
import { IntegrationEndpoint } from './entities/integration-endpoint.entity';
import { IntegrationDelivery } from './entities/integration-delivery.entity';
import { Partner } from './entities/partner.entity';
import { PartnerTenant } from './entities/partner-tenant.entity';
import { DunningCampaign } from './entities/dunning-campaign.entity';
import { DunningRun } from './entities/dunning-run.entity';
import { ArrearsSnapshot } from './entities/arrears-snapshot.entity';
import { ComplianceExportJob } from './entities/compliance-export-job.entity';
import { ComplianceExportArtifact } from './entities/compliance-export-artifact.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      CheckoutSession,
      PaymentRecoveryCandidate,
      PaymentRecoveryEvent,
      Payment,
      InstallmentPlan,
      InstallmentPlanItem,
      ContactInstallmentAccount,
      Form,
      Contact,
      Submission,
      ReconciliationRun,
      ReconciliationException,
      IntegrationEndpoint,
      IntegrationDelivery,
      Partner,
      PartnerTenant,
      DunningCampaign,
      DunningRun,
      ArrearsSnapshot,
      ComplianceExportJob,
      ComplianceExportArtifact,
    ]),
  ],
  controllers: [MarketReadinessController],
  providers: [MarketReadinessService],
  exports: [MarketReadinessService],
})
export class MarketReadinessModule {}
