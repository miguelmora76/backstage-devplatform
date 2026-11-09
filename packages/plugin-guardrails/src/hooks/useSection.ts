import { useCallback, useEffect, useRef, useState } from 'react';
import type { Failure, Result } from '../api/failures';

export type SectionState<T> =
  | { status: 'loading' }
  | { status: 'loaded'; data: T }
  | { status: 'empty' }
  | { status: 'server-error' }
  | { status: 'load-failed' };

export interface UseSectionOptions<T> {
  /** True when the data holds no items. Lists are empty when they have length 0. */
  isEmpty?: (data: T) => boolean;
  /** Plan and CI show the server error panel on SERVER_UNREACHABLE (BR6.1). */
  serverErrorPanel?: boolean;
  /**
   * Keep showing the last loaded data while a reload runs, so the controls
   * the person is using (paging, filters) keep keyboard focus (BR4.4).
   */
  keepPrevious?: boolean;
}

export interface Section<T> {
  state: SectionState<T>;
  /** The failure behind load-failed, for the screen to choose its text. */
  failure?: Failure;
  /** True while a reload runs on top of kept data (`keepPrevious`). */
  refreshing: boolean;
  /** Starts the load again: Loading, then the new result (Retry, reload). */
  reload: () => void;
}

/**
 * One load per section (performance design P1, P5). The load starts when the
 * section mounts, never waits for another section, drops an answer that
 * belongs to an older load, and is aborted on unmount.
 */
export function useSection<T>(
  load: (signal: AbortSignal) => Promise<Result<T>>,
  deps: readonly unknown[],
  options: UseSectionOptions<T> = {},
): Section<T> {
  const [state, setState] = useState<SectionState<T>>({ status: 'loading' });
  const [failure, setFailure] = useState<Failure | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const counter = useRef(0);
  const controller = useRef<AbortController | undefined>();
  const loadRef = useRef(load);
  loadRef.current = load;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const run = useCallback(() => {
    counter.current += 1;
    const mine = counter.current;
    controller.current?.abort();
    const ctl = new AbortController();
    controller.current = ctl;
    if (
      optionsRef.current.keepPrevious &&
      stateRef.current.status === 'loaded'
    ) {
      setRefreshing(true);
    } else {
      setState({ status: 'loading' });
    }
    setFailure(undefined);
    loadRef.current(ctl.signal).then(result => {
      if (mine !== counter.current || ctl.signal.aborted) {
        return; // a newer load started, or the section is gone
      }
      setRefreshing(false);
      if (result.ok) {
        const isEmpty =
          optionsRef.current.isEmpty ??
          ((d: T) => Array.isArray(d) && d.length === 0);
        setState(
          isEmpty(result.value)
            ? { status: 'empty' }
            : { status: 'loaded', data: result.value },
        );
        return;
      }
      setFailure(result.failure);
      if (
        result.failure.kind === 'server-unreachable' &&
        optionsRef.current.serverErrorPanel
      ) {
        setState({ status: 'server-error' });
      } else {
        setState({ status: 'load-failed' });
      }
    });
  }, []);

  useEffect(() => {
    run();
    return () => {
      counter.current += 1;
      controller.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  return { state, failure, refreshing, reload: run };
}
