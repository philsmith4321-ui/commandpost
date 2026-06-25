// Employee-count parsing + bucketing for the lead size filter.
// Client-safe (pure functions, no server deps) — imported by the filter UI too.

export type BucketKey = 'lt50' | '50-99' | '100-199' | '200-499' | '500+';

export const BUCKETS: { key: BucketKey; label: string; min: number; max: number | null }[] = [
  { key: 'lt50', label: '<50', min: 0, max: 49 },
  { key: '50-99', label: '50–99', min: 50, max: 99 },
  { key: '100-199', label: '100–199', min: 100, max: 199 },
  { key: '200-499', label: '200–499', min: 200, max: 499 },
  { key: '500+', label: '500+', min: 500, max: null },
];

export function isBucketKey(v: unknown): v is BucketKey {
  return typeof v === 'string' && BUCKETS.some((b) => b.key === v);
}

// Parse messy headcount strings: "51-200", "~53", "20-49 est", "50+ (24 atty)", "~25-43".
export function parseEmployees(input: string | null | undefined): { min: number | null; max: number | null } {
  if (!input) return { min: null, max: null };
  const s = String(input).replace(/\([^)]*\)/g, ' ').replace(/~/g, ' ').toLowerCase();
  const hasPlus = s.includes('+');
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return { min: null, max: null };
  if (nums.length === 1) return hasPlus ? { min: nums[0], max: null } : { min: nums[0], max: nums[0] };
  return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
}

// Assign a single bucket from the midpoint of the parsed range.
export function bucketOf(min: number | null, max: number | null): BucketKey | null {
  if (min == null && max == null) return null;
  const mid = min != null && max != null ? Math.round((min + max) / 2) : (min ?? max) as number;
  for (const b of BUCKETS) {
    if (mid >= b.min && (b.max == null || mid <= b.max)) return b.key;
  }
  return null;
}
