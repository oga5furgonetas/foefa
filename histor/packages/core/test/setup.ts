process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgres://histor:histor@localhost:5432/histor_test';
process.env.SESSION_SECRETS ??= 'test-session-secret-0123456789abcdef0123456789';
process.env.DATA_ENCRYPTION_KEY ??= 'test-encryption-key-0123456789abcdef012345678';
process.env.ANALYTICS_SALT ??= 'test-salt';
process.env.PUBLIC_BASE_URL ??= 'http://localhost:3000';
