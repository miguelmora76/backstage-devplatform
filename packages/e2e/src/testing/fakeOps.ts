import { ForwardOps } from '../portForward';

export interface FakeWorld {
  /** pid -> command line of the processes that are alive */
  table: Map<number, string>;
  killed: number[];
  spawned: Array<{ command: string; args: string[]; cwd: string }>;
  /** Answers of portFree, one per call; the last one repeats. */
  freeAnswers: boolean[];
  nextPid: number | undefined;
  sleeps: number[];
}

/** Fake machine operations for the port-forward (unit-test-instructions.md). */
export function fakeOps(partial: Partial<FakeWorld> = {}): {
  ops: ForwardOps;
  world: FakeWorld;
} {
  const world: FakeWorld = {
    table: new Map(),
    killed: [],
    spawned: [],
    freeAnswers: [true],
    nextPid: 4242,
    sleeps: [],
    ...partial,
  };
  const ops: ForwardOps = {
    spawnDetached: (command, args, cwd) => {
      world.spawned.push({ command, args, cwd });
      if (world.nextPid !== undefined) {
        world.table.set(world.nextPid, [command, ...args].join(' '));
      }
      return world.nextPid;
    },
    processCommand: pid => world.table.get(pid),
    kill: pid => {
      world.killed.push(pid);
      world.table.delete(pid);
    },
    portFree: async () =>
      world.freeAnswers.length > 1
        ? world.freeAnswers.shift()!
        : world.freeAnswers[0],
    sleep: async ms => {
      world.sleeps.push(ms);
    },
  };
  return { ops, world };
}
