import { describe, expect, it } from 'vitest';
import { matchesBookFilter } from '@/lib/audible';

const AUTHORS: Record<string, string> = {
  '$100M Offers: How to Make Offers So Good People Feel Stupid Saying No': 'Alex Hormozi',
  'Think and Grow Rich': 'Napoleon Hill',
  'The Power of Positive Thinking': 'Norman Vincent Peale',
};

describe('matchesBookFilter', () => {
  it('matches a title substring case-insensitively', () => {
    expect(matchesBookFilter('Think and Grow Rich', 'grow rich', AUTHORS)).toBe(true);
  });

  it('matches an author first name', () => {
    expect(matchesBookFilter('Think and Grow Rich', 'napoleon', AUTHORS)).toBe(true);
  });

  it('matches an author last name', () => {
    expect(matchesBookFilter('$100M Offers: How to Make Offers So Good People Feel Stupid Saying No', 'hormozi', AUTHORS)).toBe(true);
  });

  it('does not match a query found in neither title nor author', () => {
    expect(matchesBookFilter('Think and Grow Rich', 'hormozi', AUTHORS)).toBe(false);
  });

  it('falls back to title-only for books absent from the author map', () => {
    expect(matchesBookFilter('Unknown Book', 'unknown', AUTHORS)).toBe(true);
    expect(matchesBookFilter('Unknown Book', 'napoleon', AUTHORS)).toBe(false);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(matchesBookFilter('Think and Grow Rich', '  hill  ', AUTHORS)).toBe(true);
  });

  it('matches everything on a blank query', () => {
    expect(matchesBookFilter('Think and Grow Rich', '   ', AUTHORS)).toBe(true);
  });
});
