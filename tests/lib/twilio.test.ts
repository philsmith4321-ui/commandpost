import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('twilio utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('isTwilioConfigured returns false when env vars missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.ALERT_TO_NUMBER;
    const { isTwilioConfigured } = await import('@/lib/twilio');
    expect(isTwilioConfigured()).toBe(false);
  });

  it('isTwilioConfigured returns true when all env vars set', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    process.env.ALERT_TO_NUMBER = '+15559876543';
    const { isTwilioConfigured } = await import('@/lib/twilio');
    expect(isTwilioConfigured()).toBe(true);
  });

  it('sendSms calls Twilio API with correct params', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    process.env.ALERT_TO_NUMBER = '+15559876543';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM_test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendSms } = await import('@/lib/twilio');
    const result = await sendSms('Test alert message');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC_test/Messages.json');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toContain('Basic');
    expect(options.body.toString()).toContain('Test+alert+message');

    vi.unstubAllGlobals();
  });

  it('sendSms returns false on API failure', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    process.env.ALERT_TO_NUMBER = '+15559876543';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendSms } = await import('@/lib/twilio');
    const result = await sendSms('Test message');

    expect(result).toBe(false);

    vi.unstubAllGlobals();
  });
});
