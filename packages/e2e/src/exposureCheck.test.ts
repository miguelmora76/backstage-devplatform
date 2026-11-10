import { createServer } from 'node:net';
import {
  checkClosed,
  checkExposure,
  Connect,
  firstNonLoopbackIPv4,
  realConnect,
} from './exposureCheck';

const answers =
  (table: Record<string, 'accepted' | 'refused'>): Connect =>
  async host =>
    table[host] ?? 'refused';

describe('checkExposure (NFR5.13)', () => {
  it('passes when the other address is refused and loopback is accepted', async () => {
    const connect = answers({
      '127.0.0.1': 'accepted',
      '192.168.1.20': 'refused',
    });
    expect(await checkExposure(connect, '192.168.1.20')).toEqual([]);
  });

  it('fails when the non-loopback address accepts a connection', async () => {
    const connect = answers({
      '127.0.0.1': 'accepted',
      '192.168.1.20': 'accepted',
    });
    const found = await checkExposure(connect, '192.168.1.20');
    expect(found.join('\n')).toMatch(/NFR5\.13.*192\.168\.1\.20.*reachable/);
  });

  it('reports, not passes, when no non-loopback address was found', async () => {
    const found = await checkExposure(
      answers({ '127.0.0.1': 'accepted' }),
      undefined,
    );
    expect(found.join('\n')).toMatch(/no non-loopback.*not made/i);
  });

  it('fails when loopback itself refuses, because the forward is not up', async () => {
    const found = await checkExposure(answers({}), '10.0.0.5');
    expect(found.join('\n')).toMatch(/127\.0\.0\.1.*refused/);
  });
});

describe('checkClosed (NFR5.22)', () => {
  it('passes when loopback refuses after down', async () => {
    expect(await checkClosed(answers({}))).toEqual([]);
  });

  it('fails when something still answers on loopback', async () => {
    const found = await checkClosed(answers({ '127.0.0.1': 'accepted' }));
    expect(found.join('\n')).toMatch(/NFR5\.22.*still accepts/);
  });
});

describe('firstNonLoopbackIPv4', () => {
  const entry = (address: string, family: string, internal: boolean) =>
    ({ address, family, internal }) as any;

  it('takes the first external IPv4 address', () => {
    expect(
      firstNonLoopbackIPv4({
        lo0: [entry('127.0.0.1', 'IPv4', true), entry('::1', 'IPv6', true)],
        en0: [
          entry('fe80::1', 'IPv6', false),
          entry('192.168.1.7', 'IPv4', false),
        ],
        en1: [entry('10.0.0.9', 'IPv4', false)],
      }),
    ).toBe('192.168.1.7');
  });

  it('is undefined when there is none', () => {
    expect(
      firstNonLoopbackIPv4({ lo0: [entry('127.0.0.1', 'IPv4', true)] }),
    ).toBeUndefined();
    expect(firstNonLoopbackIPv4({ en0: undefined })).toBeUndefined();
  });
});

describe('realConnect', () => {
  it('tells an open port from a closed one', async () => {
    const server = createServer(socket => socket.end());
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    expect(await realConnect('127.0.0.1', port)).toBe('accepted');
    await new Promise(resolve => server.close(resolve));
    expect(await realConnect('127.0.0.1', port)).toBe('refused');
  });
});
