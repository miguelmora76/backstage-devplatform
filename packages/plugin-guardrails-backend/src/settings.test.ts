import { mockServices } from '@backstage/backend-test-utils';
import { readSettings } from './settings';

const config = (guardrails: object) =>
  mockServices.rootConfig({ data: { guardrails } as never });

describe('settings reader', () => {
  it('reads the server address and applies the defaults', () => {
    expect(
      readSettings(config({ server: { url: 'http://guardrails:8080' } })),
    ).toEqual({
      serverUrl: 'http://guardrails:8080',
      readTimeoutMs: 3000,
      writeTimeoutMs: 10000,
      demoSignInEnabled: false,
    });
  });

  it('reads timeouts and the demo sign-in switch', () => {
    expect(
      readSettings(
        config({
          server: { url: 'http://g', readTimeoutMs: 500, writeTimeoutMs: 2000 },
          demoSignIn: { enabled: true },
        }),
      ),
    ).toMatchObject({
      readTimeoutMs: 500,
      writeTimeoutMs: 2000,
      demoSignInEnabled: true,
    });
  });

  it('has no address in code: a missing or malformed one stops the start with a plain message', () => {
    expect(() => readSettings(config({}))).toThrow(/guardrails\.server\.url/);
    expect(() =>
      readSettings(config({ server: { url: 'not a url' } })),
    ).toThrow(/guardrails\.server\.url/);
    expect(() => readSettings(config({ server: { url: 'ftp://x' } }))).toThrow(
      /guardrails\.server\.url/,
    );
  });

  it('refuses timeouts that are not positive, and a write timeout that is not below the 30 second claim release', () => {
    for (const bad of [
      { readTimeoutMs: 0 },
      { writeTimeoutMs: -5 },
      { writeTimeoutMs: 30000 },
      { writeTimeoutMs: 45000 },
    ]) {
      expect(() =>
        readSettings(config({ server: { url: 'http://g', ...bad } })),
      ).toThrow(/Timeout|timeout/);
    }
  });

  it('never puts the address in an error about something else', () => {
    const read = () =>
      readSettings(
        config({
          server: { url: 'http://secret-host:1234', readTimeoutMs: 0 },
        }),
      );
    expect(read).toThrow(/readTimeoutMs/);
    expect(read).not.toThrow(/secret-host/);
  });
});
