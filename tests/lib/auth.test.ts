import { describe, it, expect } from 'vitest';

describe('auth', () => {
  it('verifyPassword returns true for correct password', async () => {
    const { verifyPassword, hashPassword } = await import('@/lib/auth');
    const hash = hashPassword('testpass123');
    const result = verifyPassword('testpass123', hash);
    expect(result).toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const { verifyPassword, hashPassword } = await import('@/lib/auth');
    const hash = hashPassword('testpass123');
    const result = verifyPassword('wrongpass', hash);
    expect(result).toBe(false);
  });

  it('createToken returns a JWT string', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-testing-purposes-1234';
    const { createToken } = await import('@/lib/auth');
    const token = await createToken();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyToken validates a token created by createToken', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-testing-purposes-1234';
    const { createToken, verifyToken } = await import('@/lib/auth');
    const token = await createToken();
    const payload = await verifyToken(token);
    expect(payload).toBeTruthy();
    expect(payload?.role).toBe('admin');
  });

  it('verifyToken returns null for invalid token', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-testing-purposes-1234';
    const { verifyToken } = await import('@/lib/auth');
    const payload = await verifyToken('invalid.token.here');
    expect(payload).toBeNull();
  });
});
