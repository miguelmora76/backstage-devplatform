import type { Failure } from '../api/failures';

/** What the plan and CI sections tell the view (BR2.1, BR2.4, BR6.2). */
export interface ProposeSectionProps {
  service: string;
  /** Changes when the view wants this section to load again. */
  version: number;
  /** True while any section shows the server error panel (BR6.2). */
  writesDisabled: boolean;
  onServerDown: (down: boolean) => void;
  onProposed: () => void;
  onWriteFailed: (failure: Failure) => void;
}
