import { ReminderSchedulerService } from './reminder-scheduler.service';
import { ReminderAutomationService } from './reminder-automation.service';

describe('ReminderSchedulerService', () => {
  let service: ReminderSchedulerService;

  const policyRepository = {
    createQueryBuilder: jest.fn(),
  };

  const reminderAutomationService = {
    executeRemindersForOrganization: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reminderAutomationService.executeRemindersForOrganization.mockResolvedValue({
      sent: 0,
      failed: 0,
    });

    service = new ReminderSchedulerService(
      policyRepository as any,
      reminderAutomationService as any,
    );
  });

  const stubOrganizations = (rows: Array<{ organization_id: string }>) => {
    const getRawMany = jest.fn().mockResolvedValue(rows);
    policyRepository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany,
    });
  };

  it('runs the enabled policies of every organization that has one', async () => {
    stubOrganizations([{ organization_id: 'org-1' }, { organization_id: 'org-2' }]);

    await service.runScheduledReminders();

    expect(reminderAutomationService.executeRemindersForOrganization).toHaveBeenCalledTimes(2);
    expect(reminderAutomationService.executeRemindersForOrganization).toHaveBeenCalledWith('org-1');
    expect(reminderAutomationService.executeRemindersForOrganization).toHaveBeenCalledWith('org-2');
  });

  it('does nothing when no organization has an enabled policy', async () => {
    stubOrganizations([]);

    await service.runScheduledReminders();

    expect(reminderAutomationService.executeRemindersForOrganization).not.toHaveBeenCalled();
  });

  it('keeps going when one organization fails', async () => {
    stubOrganizations([{ organization_id: 'org-1' }, { organization_id: 'org-2' }]);
    reminderAutomationService.executeRemindersForOrganization
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ sent: 3, failed: 0 });

    await expect(service.runScheduledReminders()).resolves.toBeUndefined();

    expect(reminderAutomationService.executeRemindersForOrganization).toHaveBeenCalledTimes(2);
  });

  it('does not blow up when the organization query fails', async () => {
    policyRepository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(service.runScheduledReminders()).resolves.toBeUndefined();

    expect(reminderAutomationService.executeRemindersForOrganization).not.toHaveBeenCalled();
  });

  it('skips a tick when the previous run has not finished', async () => {
    stubOrganizations([{ organization_id: 'org-1' }]);

    let release: () => void = () => undefined;
    reminderAutomationService.executeRemindersForOrganization.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ sent: 0, failed: 0 });
        }),
    );

    const first = service.runScheduledReminders();
    // Second tick arrives while the first is still running.
    await service.runScheduledReminders();

    expect(reminderAutomationService.executeRemindersForOrganization).toHaveBeenCalledTimes(1);

    release();
    await first;
  });

  it('exposes a single-organization runner for the manual trigger', async () => {
    reminderAutomationService.executeRemindersForOrganization.mockResolvedValue({
      sent: 2,
      failed: 1,
    });

    const result = await service.runForOrganization('org-9');

    expect(result).toEqual({ sent: 2, failed: 1 });
    expect(reminderAutomationService.executeRemindersForOrganization).toHaveBeenCalledWith('org-9');
  });
});
