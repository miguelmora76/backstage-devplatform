import { CommandResult, RunOptions, Runner } from '../runner';

export interface Call {
  command: string;
  args: string[];
  options?: RunOptions;
  /** command and arguments as one line, for readable assertions */
  line: string;
}

type Result = Partial<CommandResult> | ((call: Call) => Partial<CommandResult>);

export interface Rule {
  /** Every token must appear as a word of the command line. */
  when: string[];
  result?: Result;
}

const ok: CommandResult = { status: 0, stdout: '', stderr: '' };

/**
 * A scripted Runner for the unit tests (unit-test-instructions.md, "Mocking and
 * Stubbing"): it records every call, answers from the first rule whose tokens
 * all appear, and fails the test on a call nobody scripted, so an unplanned
 * `kubectl` or `minikube` call is caught.
 */
export function fakeRunner(rules: Rule[] = []): {
  run: Runner;
  calls: Call[];
  lines: () => string[];
} {
  const calls: Call[] = [];
  const run: Runner = (command, args, options) => {
    const call: Call = {
      command,
      args,
      options,
      line: [command, ...args].join(' '),
    };
    calls.push(call);
    // Words, so a token also matches inside a command string passed as one argument.
    const words = new Set(call.line.split(/[\s'"]+/));
    const rule = rules.find(r => r.when.every(token => words.has(token)));
    if (!rule) {
      throw new Error(`Unscripted call: ${call.line}`);
    }
    const result =
      typeof rule.result === 'function' ? rule.result(call) : rule.result;
    return { ...ok, ...result };
  };
  return { run, calls, lines: () => calls.map(c => c.line) };
}
