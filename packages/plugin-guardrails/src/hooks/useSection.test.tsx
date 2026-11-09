import { act, renderHook, waitFor } from '@testing-library/react';
import { useSection } from './useSection';
import { fail, ok, type Result } from '../api/failures';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useSection (P1, P5; BR1.2, BR6.1, BR6.3)', () => {
  it('starts Loading and ends Loaded with the data', async () => {
    const { result } = renderHook(() => useSection(async () => ok([1, 2]), []));
    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'loaded', data: [1, 2] }),
    );
  });

  it('ends Empty when the list has no items', async () => {
    const { result } = renderHook(() => useSection(async () => ok([]), []));
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'empty' }),
    );
  });

  it('uses the isEmpty option for non-list data', async () => {
    const { result } = renderHook(() =>
      useSection(async () => ok({ total: 0 }), [], {
        isEmpty: d => d.total === 0,
      }),
    );
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'empty' }),
    );
  });

  it('ends ServerError on server-unreachable when asked to, otherwise LoadFailed', async () => {
    const down = async (): Promise<Result<number[]>> =>
      fail({ kind: 'server-unreachable' });
    const a = renderHook(() =>
      useSection(down, [], { serverErrorPanel: true }),
    );
    await waitFor(() =>
      expect(a.result.current.state).toEqual({ status: 'server-error' }),
    );
    const b = renderHook(() => useSection(down, []));
    await waitFor(() =>
      expect(b.result.current.state).toEqual({ status: 'load-failed' }),
    );
  });

  it('ends LoadFailed on any other failure and keeps the failure for the screen', async () => {
    const { result } = renderHook(() =>
      useSection(
        async (): Promise<Result<number[]>> => fail({ kind: 'no-answer' }),
        [],
      ),
    );
    await waitFor(() =>
      expect(result.current.state.status).toBe('load-failed'),
    );
    expect(result.current.failure).toEqual({ kind: 'no-answer' });
  });

  it('goes back to Loading on reload and Retry, then to the new result', async () => {
    let n = 0;
    const { result } = renderHook(() =>
      useSection(async () => ok([(n += 1)]), []),
    );
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    act(() => result.current.reload());
    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'loaded', data: [2] }),
    );
  });

  it('drops a stale answer that arrives after a newer load started', async () => {
    const first = deferred<Result<number[]>>();
    const second = deferred<Result<number[]>>();
    const loads = [first, second];
    let i = 0;
    const { result } = renderHook(() =>
      useSection(() => loads[i++].promise, []),
    );
    act(() => result.current.reload());
    await act(async () => {
      second.resolve(ok([2]));
    });
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'loaded', data: [2] }),
    );
    await act(async () => {
      first.resolve(ok([1]));
    });
    expect(result.current.state).toEqual({ status: 'loaded', data: [2] });
  });

  it('reloads when its dependencies change', async () => {
    const { result, rerender } = renderHook(
      ({ page }) => useSection(async () => ok([page]), [page]),
      { initialProps: { page: 1 } },
    );
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'loaded', data: [1] }),
    );
    rerender({ page: 2 });
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'loaded', data: [2] }),
    );
  });

  it('aborts the call and sets no state after unmount', async () => {
    let signal: AbortSignal | undefined;
    const gate = deferred<Result<number[]>>();
    const { unmount } = renderHook(() =>
      useSection(s => {
        signal = s;
        return gate.promise;
      }, []),
    );
    unmount();
    expect(signal?.aborted).toBe(true);
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      gate.resolve(ok([1]));
    });
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  describe('parallel sections (NFR1.2, BR7.4)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('four sections with 300 ms answers are all loaded within 700 ms', async () => {
      const slow = () =>
        new Promise<Result<number[]>>(resolve =>
          setTimeout(() => resolve(ok([1])), 300),
        );
      const { result } = renderHook(() => ({
        plan: useSection(slow, []),
        ci: useSection(slow, []),
        open: useSection(slow, []),
        audit: useSection(slow, []),
      }));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(700);
      });
      for (const s of Object.values(result.current)) {
        expect(s.state.status).toBe('loaded');
      }
    });
  });
});
