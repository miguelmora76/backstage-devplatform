import { checkRestarts } from './restartCheck';

const pod = (name: string, restarts: number[], init: number[] = []) => ({
  metadata: { name },
  status: {
    containerStatuses: restarts.map(restartCount => ({ restartCount })),
    initContainerStatuses: init.map(restartCount => ({ restartCount })),
  },
});
const list = (...items: object[]) => JSON.stringify({ items });

describe('checkRestarts (NFR1.6)', () => {
  it('passes when every pod has 0 restarts', () => {
    expect(
      checkRestarts(list(pod('app-1', [0]), pod('postgres-0', [0], [0, 0]))),
    ).toEqual([]);
  });

  it('fails and names a pod with restarts', () => {
    const found = checkRestarts(
      list(pod('app-1', [0]), pod('guardrails-server-x', [2, 0])),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/guardrails-server-x.*2 restart/);
  });

  it('counts the restarts of an init container as well', () => {
    expect(checkRestarts(list(pod('app-1', [0], [1])))[0]).toMatch(
      /app-1.*1 restart/,
    );
  });

  it('treats a pod with no status yet as no restarts', () => {
    expect(checkRestarts(list({ metadata: { name: 'pending-1' } }))).toEqual(
      [],
    );
  });

  it('reports an empty pod list instead of passing it', () => {
    expect(checkRestarts(list())[0]).toMatch(/no pods/i);
  });

  it('is an error when the text is not the JSON of a pod list', () => {
    expect(() => checkRestarts('not json')).toThrow(/could not read/i);
    expect(() => checkRestarts('{"kind":"Status"}')).toThrow(/could not read/i);
  });
});
