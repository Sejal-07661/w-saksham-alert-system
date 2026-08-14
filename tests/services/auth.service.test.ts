import { hashPassword, comparePassword, signToken, verifyToken } from '../../src/services/auth.service';

describe('password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('test1234');
    expect(hash).not.toBe('test1234');
    expect(await comparePassword('test1234', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('test1234');
    expect(await comparePassword('wrongpassword', hash)).toBe(false);
  });
});

describe('JWT tokens', () => {
  const payload = { userId: '123', username: 'testuser', role: 'citizen' };

  it('signs and verifies a token round-trip', () => {
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.username).toBe('testuser');
    expect(decoded.role).toBe('citizen');
  });

  it('throws on a malformed token', () => {
    expect(() => verifyToken('not.a.real.token')).toThrow();
  });
});