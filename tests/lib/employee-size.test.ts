import { describe, it, expect } from 'vitest';
import { parseEmployees, bucketOf } from '@/lib/outreach/employee-size';

describe('parseEmployees', () => {
  it('parses ranges, tildes, estimates, and plus', () => {
    expect(parseEmployees('51-200')).toEqual({ min: 51, max: 200 });
    expect(parseEmployees('~53')).toEqual({ min: 53, max: 53 });
    expect(parseEmployees('20-49 est')).toEqual({ min: 20, max: 49 });
    expect(parseEmployees('200-400 est')).toEqual({ min: 200, max: 400 });
    expect(parseEmployees('50+')).toEqual({ min: 50, max: null });
    expect(parseEmployees('50+ (24 atty)')).toEqual({ min: 50, max: null });
    expect(parseEmployees('~25-43')).toEqual({ min: 25, max: 43 });
    expect(parseEmployees('30-50 core')).toEqual({ min: 30, max: 50 });
  });
  it('handles empty/garbage', () => {
    expect(parseEmployees('')).toEqual({ min: null, max: null });
    expect(parseEmployees(null)).toEqual({ min: null, max: null });
    expect(parseEmployees('Unknown')).toEqual({ min: null, max: null });
  });
});

describe('bucketOf', () => {
  it('assigns one bucket from the midpoint', () => {
    expect(bucketOf(5, 12)).toBe('lt20'); // mid 8.5 -> 9
    expect(bucketOf(10, 19)).toBe('lt20'); // mid 14.5 -> 15
    expect(bucketOf(20, 49)).toBe('20-49'); // mid 34
    expect(bucketOf(53, 53)).toBe('50-99');
    expect(bucketOf(51, 200)).toBe('100-199'); // mid 125
    expect(bucketOf(200, 400)).toBe('200-499'); // mid 300
    expect(bucketOf(50, null)).toBe('50-99');
    expect(bucketOf(600, null)).toBe('500+');
    expect(bucketOf(null, null)).toBeNull();
  });
});
