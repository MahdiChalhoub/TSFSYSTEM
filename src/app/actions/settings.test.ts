import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProductNamingRule, saveProductNamingRule, SETTING_KEY } from './settings';
import { prisma } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    systemSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Settings Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProductNamingRule', () => {
    it('should return default rule if no setting found', async () => {
      (prisma.systemSettings.findUnique as any).mockResolvedValue(null);

      const rule = await getProductNamingRule();

      expect(rule).toBeDefined();
      expect(rule.components).toHaveLength(5);
      expect(prisma.systemSettings.findUnique).toHaveBeenCalledWith({ where: { key: SETTING_KEY } });
    });

    it('should return parsed rule if valid setting exists', async () => {
      const mockRule = {
        components: [],
        separator: '-',
      };
      (prisma.systemSettings.findUnique as any).mockResolvedValue({
        value: JSON.stringify(mockRule),
      });

      const rule = await getProductNamingRule();

      expect(rule.separator).toBe('-');
    });

    it('should return default rule if JSON is invalid', async () => {
      (prisma.systemSettings.findUnique as any).mockResolvedValue({
        value: 'INVALID_JSON',
      });

      const rule = await getProductNamingRule();

      expect(rule.separator).toBe(' '); // Default separator
    });

    it('should return default rule if schema validation fails', async () => {
      (prisma.systemSettings.findUnique as any).mockResolvedValue({
        value: JSON.stringify({ wrongKey: 'val' }),
      });

      const rule = await getProductNamingRule();

      expect(rule.separator).toBe(' ');
    });
  });

  describe('saveProductNamingRule', () => {
    it('should save valid rule', async () => {
      const validRule = {
        components: [],
        separator: '|',
      };

      const result = await saveProductNamingRule(validRule);

      expect(result.success).toBe(true);
      expect(prisma.systemSettings.upsert).toHaveBeenCalledWith({
        where: { key: SETTING_KEY },
        update: { value: JSON.stringify(validRule) },
        create: { key: SETTING_KEY, value: JSON.stringify(validRule) },
      });
    });

    it('should reject invalid rule', async () => {
      const invalidRule = {
        components: 'not-an-array', // Invalid type
        separator: 123, // Invalid type
      } as any;

      const result = await saveProductNamingRule(invalidRule);

      expect(result.success).toBe(false);
      expect(prisma.systemSettings.upsert).not.toHaveBeenCalled();
    });
  });
});
