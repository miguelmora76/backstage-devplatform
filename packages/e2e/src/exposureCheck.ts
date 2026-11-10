import { connect as netConnect } from 'node:net';
import { networkInterfaces, NetworkInterfaceInfo } from 'node:os';

export const SAMPLE_PORT = 7007;
const LOOPBACK = '127.0.0.1';

export type Connect = (
  host: string,
  port: number,
) => Promise<'accepted' | 'refused'>;

/** A real TCP connection attempt: anything but a completed connect is "refused". */
export const realConnect: Connect = (host, port) =>
  new Promise(resolve => {
    const socket = netConnect({ host, port });
    const done = (answer: 'accepted' | 'refused') => {
      socket.destroy();
      resolve(answer);
    };
    socket.setTimeout(2000, () => done('refused'));
    socket.once('connect', () => done('accepted'));
    socket.once('error', () => done('refused'));
  });

/** The first external IPv4 address of this machine, for the exposure check. */
export function firstNonLoopbackIPv4(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): string | undefined {
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return undefined;
}

/**
 * While the sample runs, the port must answer on loopback and be refused on
 * the machine's other address: the forward listens on 127.0.0.1 only
 * (NFR5.13). No address to test is reported, never passed.
 */
export async function checkExposure(
  connect: Connect,
  address: string | undefined,
  port: number = SAMPLE_PORT,
): Promise<string[]> {
  if (address === undefined) {
    return [
      'NFR5.13: no non-loopback IPv4 address was found on this machine, so the exposure check was not made.',
    ];
  }
  const problems: string[] = [];
  if ((await connect(address, port)) === 'accepted') {
    problems.push(
      `NFR5.13: port ${port} is reachable on ${address}; it must be reachable on ${LOOPBACK} only.`,
    );
  }
  if ((await connect(LOOPBACK, port)) !== 'accepted') {
    problems.push(
      `NFR5.13: a connection to ${LOOPBACK}:${port} was refused, so the port-forward is not up.`,
    );
  }
  return problems;
}

/** After `minikube:down` nothing may answer on the sample port any more (NFR5.22). */
export async function checkClosed(
  connect: Connect,
  port: number = SAMPLE_PORT,
): Promise<string[]> {
  return (await connect(LOOPBACK, port)) === 'accepted'
    ? [`NFR5.22: ${LOOPBACK}:${port} still accepts connections after down.`]
    : [];
}
