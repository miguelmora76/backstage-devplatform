/**
 * The changes made since start (NFR7.3). Held in memory only and lost on
 * restart. A write is one synchronous set insertion, so repeating it changes
 * nothing and two calls can never interleave inside a write (BR2.6).
 */
export class RuntimeOverlay {
  private readonly upgraded = new Set<string>();
  private readonly rerun = new Set<string>();

  get upgradedDependencies(): ReadonlySet<string> {
    return this.upgraded;
  }

  get rerunRuns(): ReadonlySet<string> {
    return this.rerun;
  }

  isUpgraded(dependencyKey: string): boolean {
    return this.upgraded.has(dependencyKey);
  }

  isRerun(runKey: string): boolean {
    return this.rerun.has(runKey);
  }

  /** Returns true when the key was added, false when it was already there. */
  markUpgraded(dependencyKey: string): boolean {
    const had = this.upgraded.has(dependencyKey);
    this.upgraded.add(dependencyKey);
    return !had;
  }

  /** Returns true when the key was added, false when it was already there. */
  markRerun(runKey: string): boolean {
    const had = this.rerun.has(runKey);
    this.rerun.add(runKey);
    return !had;
  }
}
