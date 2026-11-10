interface ContainerStatus {
  restartCount?: number;
}
interface Pod {
  metadata?: { name?: string };
  status?: {
    containerStatuses?: ContainerStatus[];
    initContainerStatuses?: ContainerStatus[];
  };
}

/**
 * Reads `kubectl get pods -o json` and fails every pod with a restart count
 * other than 0 (monitoring-design.md: "0 during a normal run"). A malformed
 * text is an error; an empty list is reported, not passed.
 */
export function checkRestarts(podsJson: string): string[] {
  let items: Pod[];
  try {
    const parsed = JSON.parse(podsJson);
    if (!Array.isArray(parsed?.items)) throw new Error('no items');
    items = parsed.items;
  } catch (error) {
    throw new Error(
      `Could not read the pod list (${(error as Error).message}).`,
    );
  }
  if (items.length === 0) {
    return ['NFR1.6: there are no pods in the namespace to check.'];
  }
  const problems: string[] = [];
  for (const pod of items) {
    const statuses = [
      ...(pod.status?.containerStatuses ?? []),
      ...(pod.status?.initContainerStatuses ?? []),
    ];
    const restarts = statuses.reduce(
      (sum, s) => sum + (s.restartCount ?? 0),
      0,
    );
    if (restarts !== 0) {
      problems.push(
        `NFR1.6: pod ${pod.metadata?.name ?? '?'} had ${restarts} restart(s); it must have 0 in a normal run.`,
      );
    }
  }
  return problems;
}
