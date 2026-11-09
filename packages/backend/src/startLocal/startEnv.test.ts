import { buildStartEnv, parseEnvFile, parseStartArgs } from './startEnv';

describe('start:local environment', () => {
  it('reads NAME=value lines, ignoring comments, blanks and quotes (Q1: A)', () => {
    const text = [
      '# a comment',
      '',
      'GUARDRAILS_SERVER_URL=http://localhost:7100',
      'APP_BASE_URL="http://localhost:3000"',
      "BACKEND_PORT='7007'",
      '  # POSTGRES_HOST=',
      'not a setting line',
    ].join('\n');
    expect(parseEnvFile(text)).toEqual({
      GUARDRAILS_SERVER_URL: 'http://localhost:7100',
      APP_BASE_URL: 'http://localhost:3000',
      BACKEND_PORT: '7007',
    });
  });

  it('never replaces a variable that is already set in the shell', () => {
    const env = buildStartEnv(
      { GUARDRAILS_SERVER_URL: 'http://shell.test' },
      {
        GUARDRAILS_SERVER_URL: 'http://file.test',
        APP_BASE_URL: 'http://a.test',
      },
      { demo: false },
    );
    expect(env.GUARDRAILS_SERVER_URL).toBe('http://shell.test');
    expect(env.APP_BASE_URL).toBe('http://a.test');
  });

  it('turns the demo sign-in on for this run only with --demo (BR4.2)', () => {
    const file = { GUARDRAILS_DEMO_SIGN_IN: 'false' };
    expect(
      buildStartEnv({}, file, { demo: true }).GUARDRAILS_DEMO_SIGN_IN,
    ).toBe('true');
    expect(
      buildStartEnv({}, file, { demo: false }).GUARDRAILS_DEMO_SIGN_IN,
    ).toBe('false');
    expect(buildStartEnv({}, {}, { demo: false }).GUARDRAILS_DEMO_SIGN_IN).toBe(
      undefined,
    );
  });

  it('accepts --demo and nothing else', () => {
    expect(parseStartArgs([])).toEqual({ demo: false });
    expect(parseStartArgs(['--demo'])).toEqual({ demo: true });
    expect(() => parseStartArgs(['--other'])).toThrow(/Usage/);
  });
});
