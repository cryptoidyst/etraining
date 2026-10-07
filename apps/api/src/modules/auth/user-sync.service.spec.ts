import { ForbiddenException } from '@nestjs/common';
import { UserSyncService } from './user-sync.service';
import { AdUserRecord } from './ad/ad-directory.interface';

function makeAdUser(overrides: Partial<AdUserRecord> = {}): AdUserRecord {
  return {
    username: 'jdoe',
    dn: 'CN=John Doe,CN=Users,DC=lab,DC=local',
    fullName: 'John Doe',
    email: 'jdoe@lab.local',
    employeeId: 'E1001',
    department: 'Information Technology',
    jobTitle: 'Engineer',
    groups: ['Training-Staff'],
    enabled: true,
    ...overrides,
  };
}

describe('UserSyncService', () => {
  let service: UserSyncService;
  let config: { get: jest.Mock };

  beforeEach(() => {
    config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, string> = {
          'ad.groupAdmin': 'Training-Admins',
          'ad.groupStaff': 'Training-Staff',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new UserSyncService({} as never, config as never);
  });

  describe('resolveRole', () => {
    it('maps Training-Admins to administrator', () => {
      expect(service.resolveRole(['Training-Admins'])).toBe('administrator');
    });

    it('maps Training-Staff to staff', () => {
      expect(service.resolveRole(['Training-Staff'])).toBe('staff');
    });

    it('prefers administrator when in both groups', () => {
      expect(service.resolveRole(['Training-Staff', 'Training-Admins'])).toBe('administrator');
    });

    it('returns null when in no mapped group', () => {
      expect(service.resolveRole(['Domain Users'])).toBeNull();
    });

    it('is case-insensitive', () => {
      expect(service.resolveRole(['training-staff'])).toBe('staff');
    });
  });

  describe('syncFromAd', () => {
    it('rejects disabled accounts', async () => {
      await expect(service.syncFromAd(makeAdUser({ enabled: false }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects users without a mapped role', async () => {
      await expect(
        service.syncFromAd(makeAdUser({ groups: ['Domain Users'] })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
