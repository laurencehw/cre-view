import { formatCurrency, formatPercent } from '../format';

describe('formatCurrency', () => {
  describe('compact mode', () => {
    it('formats billions', () => {
      expect(formatCurrency(2_100_000_000, true)).toBe('$2.1B');
    });

    it('formats millions', () => {
      expect(formatCurrency(94_500_000, true)).toBe('$94.5M');
    });

    it('formats thousands', () => {
      expect(formatCurrency(5_000, true)).toBe('$5K');
    });

    it('formats small values', () => {
      expect(formatCurrency(500, true)).toBe('$500');
    });

    it('formats zero', () => {
      expect(formatCurrency(0, true)).toBe('$0');
    });

    it('formats exact billion boundary', () => {
      expect(formatCurrency(1_000_000_000, true)).toBe('$1.0B');
    });

    it('formats exact million boundary', () => {
      expect(formatCurrency(1_000_000, true)).toBe('$1.0M');
    });

    it('formats negative billions', () => {
      expect(formatCurrency(-2_100_000_000, true)).toBe('-$2.1B');
    });

    it('formats negative millions', () => {
      expect(formatCurrency(-50_000_000, true)).toBe('-$50.0M');
    });

    it('formats negative thousands', () => {
      expect(formatCurrency(-5_000, true)).toBe('-$5K');
    });

    it('formats negative small values', () => {
      expect(formatCurrency(-500, true)).toBe('-$500');
    });
  });

  describe('full mode', () => {
    it('formats with commas and dollar sign', () => {
      expect(formatCurrency(1_234_567)).toBe('$1,234,567');
    });

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0');
    });
  });
});

describe('formatPercent', () => {
  it('formats decimal as percentage', () => {
    expect(formatPercent(0.045)).toBe('4.5%');
  });

  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formats 100%', () => {
    expect(formatPercent(1)).toBe('100.0%');
  });

  it('respects custom decimal places', () => {
    expect(formatPercent(0.0625, 2)).toBe('6.25%');
  });

  it('formats small percentages', () => {
    expect(formatPercent(0.001)).toBe('0.1%');
  });
});
