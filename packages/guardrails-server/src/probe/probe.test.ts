import { freePort } from '../testing/freePort';
import { startTestServer } from '../testing/testServer';
import { healthExitCode } from './healthcheck';
import { runSmoke } from './smoke';

describe('healthExitCode (container health probe)', () => {
  it('exits 0 when the health route answers ready', async () => {
    const server = await startTestServer();
    try {
      expect(await healthExitCode({ PORT: String(server.port) })).toBe(0);
    } finally {
      await server.close();
    }
  });

  it('exits 1 when nothing listens on the port', async () => {
    const port = await freePort();
    expect(await healthExitCode({ PORT: String(port) })).toBe(1);
  });

  it('exits 1 for a missing or invalid PORT setting', async () => {
    expect(await healthExitCode({})).toBe(1);
    expect(await healthExitCode({ PORT: 'abc' })).toBe(1);
    expect(await healthExitCode({ PORT: '0' })).toBe(1);
  });
});

describe('runSmoke (container smoke call)', () => {
  it('calls one tool for a seeded service and reports ok', async () => {
    const server = await startTestServer();
    try {
      const result = await runSmoke({ PORT: String(server.port) });
      expect(result.ok).toBe(true);
      expect(result.message).toMatch(/^smoke ok: list_upgrade_plan /);
    } finally {
      await server.close();
    }
  });

  it('reports a failed call when the server is forced to fail', async () => {
    const server = await startTestServer({ failureMode: true });
    try {
      const result = await runSmoke({ PORT: String(server.port) });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('FORCED_FAILURE');
    } finally {
      await server.close();
    }
  });

  it('reports a failure when the server cannot be reached or settings are invalid', async () => {
    const port = await freePort();
    const unreachable = await runSmoke({ PORT: String(port) });
    expect(unreachable.ok).toBe(false);
    const invalid = await runSmoke({ PORT: 'abc' });
    expect(invalid).toEqual({
      ok: false,
      message: 'Invalid PORT: expected a whole number from 1 to 65535.',
    });
  });
});
