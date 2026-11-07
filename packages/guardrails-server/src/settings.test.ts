import { DEFAULT_SEED } from './generator';
import { readSettings } from './settings';

describe('readSettings', () => {
  it('reads valid values (BR3.2)', () => {
    expect(
      readSettings({
        GUARDRAILS_SEED: '1234',
        GUARDRAILS_FAILURE_MODE: 'on',
        PORT: '7007',
      }),
    ).toEqual({
      ok: true,
      settings: { seed: 1234, failureMode: 'on', port: 7007 },
    });
  });

  it('uses the defaults for a seed and failure mode that are not given', () => {
    expect(readSettings({ PORT: '8080' })).toEqual({
      ok: true,
      settings: { seed: DEFAULT_SEED, failureMode: 'off', port: 8080 },
    });
  });

  it('accepts a negative or large whole-number seed and the off mode', () => {
    expect(
      readSettings({
        GUARDRAILS_SEED: '-5',
        GUARDRAILS_FAILURE_MODE: 'off',
        PORT: '1',
      }),
    ).toMatchObject({ ok: true, settings: { seed: -5, failureMode: 'off' } });
    expect(
      readSettings({ GUARDRAILS_SEED: '1099511627781', PORT: '65535' }),
    ).toMatchObject({
      ok: true,
      settings: { seed: 1099511627781, port: 65535 },
    });
  });

  it.each(['abc', '1.5', '', ' 7', '1e3', '99999999999999999999'])(
    'refuses the seed %p with a sentence naming the setting',
    seed => {
      expect(readSettings({ GUARDRAILS_SEED: seed, PORT: '7007' })).toEqual({
        ok: false,
        message: 'Invalid GUARDRAILS_SEED: expected a whole number.',
      });
    },
  );

  it.each(['yes', 'ON', 'true', '1', ''])(
    'refuses the failure mode %p with a sentence naming the setting',
    mode => {
      expect(
        readSettings({ GUARDRAILS_FAILURE_MODE: mode, PORT: '7007' }),
      ).toEqual({
        ok: false,
        message: 'Invalid GUARDRAILS_FAILURE_MODE: expected on or off.',
      });
    },
  );

  it.each([undefined, '', '0', '65536', '-1', '80.5', 'http', '70 07'])(
    'refuses the port %p with a sentence naming the setting',
    port => {
      expect(readSettings({ PORT: port })).toEqual({
        ok: false,
        message: 'Invalid PORT: expected a whole number from 1 to 65535.',
      });
    },
  );

  it('never repeats the offending value in its sentence (NFR5.4)', () => {
    const result = readSettings({
      GUARDRAILS_SEED: 'secret-looking-value-123',
      PORT: '7007',
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret-looking-value-123');
  });

  it('reports the first invalid setting when several are wrong', () => {
    expect(
      readSettings({
        GUARDRAILS_SEED: 'x',
        GUARDRAILS_FAILURE_MODE: 'y',
        PORT: 'z',
      }),
    ).toEqual({
      ok: false,
      message: 'Invalid GUARDRAILS_SEED: expected a whole number.',
    });
  });
});
