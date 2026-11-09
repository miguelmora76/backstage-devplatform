import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { GuardedButton } from './GuardedButton';
import { StatusLabel } from './StatusLabel';
import { ReasonField, REASON_LIMIT } from './ReasonField';
import { PagedTable } from './PagedTable';
import { SectionState } from './SectionState';
import { ServerErrorPanel } from './ServerErrorPanel';
import { ResultBanner } from './ResultBanner';
import { RefusalAlert } from './RefusalAlert';
import type { SectionState as State } from '../hooks/useSection';

describe('GuardedButton (BR3.5, BR2.2; NFR1.5, NFR5.8)', () => {
  const never = () => new Promise<void>(() => {});

  it('calls onActivate once when allowed', async () => {
    const onActivate = jest.fn();
    render(
      <GuardedButton
        label="Propose change"
        ariaLabel="Propose change for lib-a"
        enabled
        onActivate={onActivate}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Propose change for lib-a' }),
    );
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('stays focusable, is marked unavailable and sends nothing when not allowed', async () => {
    const onActivate = jest.fn();
    render(
      <GuardedButton
        label="Approve"
        enabled={false}
        reasonKey="disabled.auditor"
        onActivate={onActivate}
      />,
    );
    const button = screen.getByRole('button', { name: 'Approve' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    await userEvent.keyboard('{Enter}');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('shows the reason text and links it to the button', () => {
    render(
      <GuardedButton
        label="Approve"
        enabled={false}
        reasonKey="disabled.proposer"
        onActivate={jest.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: 'Approve' });
    expect(button).toHaveAccessibleDescription(
      'You proposed this change, so someone else must decide it.',
    );
  });

  it('shows no reason text for a disabled action without one', () => {
    render(
      <GuardedButton label="Approve" enabled={false} onActivate={jest.fn()} />,
    );
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-describedby');
  });

  it('shows "Working..." in the same render as the press, before any answer', () => {
    render(<GuardedButton label="Approve" enabled onActivate={never} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Working...');
  });

  it('ignores a second press, even inside one frame', () => {
    const onActivate = jest.fn(never);
    render(<GuardedButton label="Approve" enabled onActivate={onActivate} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('can be pressed again after the action ends', async () => {
    const onActivate = jest.fn(async () => {});
    render(<GuardedButton label="Approve" enabled onActivate={onActivate} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('button'));
    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button')).toHaveTextContent('Approve');
  });

  it('shows Working when the owner says the screen is busy, and does not send', async () => {
    const onActivate = jest.fn();
    render(
      <GuardedButton label="Approve" enabled busy onActivate={onActivate} />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Working...');
    await userEvent.click(screen.getByRole('button'));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <div>
        <GuardedButton label="Approve" enabled onActivate={jest.fn()} />
        <GuardedButton
          label="Reject"
          enabled={false}
          reasonKey="disabled.auditor"
          onActivate={jest.fn()}
        />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('StatusLabel (BR7.1)', () => {
  it.each([
    ['pending', 'Pending'],
    ['applied', 'Applied'],
    ['rejected', 'Rejected'],
    ['failed', 'Failed'],
    ['refused', 'Refused'],
    ['proposed', 'Proposed'],
  ] as const)('shows an icon and the word %s', (status, word) => {
    const { container } = render(<StatusLabel status={status} />);
    expect(screen.getByText(word)).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<StatusLabel status="failed" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ReasonField (BR3.2, BR7.3; NFR5.7)', () => {
  function Harness({ error }: { error?: boolean }) {
    const [value, setValue] = useState('');
    return (
      <ReasonField
        value={value}
        onChange={setValue}
        errorKey={error ? 'error.reasonRequired' : undefined}
      />
    );
  }

  it('has a visible label and shows the count always', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Reason (required)')).toBeInTheDocument();
    expect(screen.getByText('500 characters left')).toBeInTheDocument();
  });

  it('keeps at most 500 characters', async () => {
    render(<Harness />);
    const box = screen.getByLabelText(
      'Reason (required)',
    ) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'x'.repeat(501) } });
    expect(box.value).toHaveLength(REASON_LIMIT);
    expect(screen.getByTestId('reason-count')).toHaveTextContent(
      '0 characters left',
    );
  });

  it('announces the count only at 100, 50, 20 and 0 left', () => {
    render(<Harness />);
    const box = screen.getByLabelText('Reason (required)');
    const live = () => screen.getByTestId('reason-announcement').textContent;
    fireEvent.change(box, { target: { value: 'x'.repeat(399) } });
    expect(live()).toBe('');
    fireEvent.change(box, { target: { value: 'x'.repeat(400) } });
    expect(live()).toBe('100 characters left');
    fireEvent.change(box, { target: { value: 'x'.repeat(430) } });
    expect(live()).toBe('');
    fireEvent.change(box, { target: { value: 'x'.repeat(450) } });
    expect(live()).toBe('50 characters left');
    fireEvent.change(box, { target: { value: 'x'.repeat(480) } });
    expect(live()).toBe('20 characters left');
    fireEvent.change(box, { target: { value: 'x'.repeat(500) } });
    expect(live()).toBe('0 characters left');
  });

  it('links the error text to the box', () => {
    render(<Harness error />);
    const box = screen.getByLabelText('Reason (required)');
    expect(box).toHaveAccessibleDescription(/Enter a reason\./);
    expect(box).toHaveAttribute('aria-invalid', 'true');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Harness error />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('PagedTable (BR4.4, BR7.1)', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    name: `row ${i}`,
  }));
  const columns = [
    { key: 'name', header: 'Name', render: (r: { name: string }) => r.name },
  ];

  it('has a caption, header cells and the rows', () => {
    render(
      <PagedTable
        caption="Audit log"
        columns={columns}
        rows={rows}
        rowKey={r => String(r.id)}
        page={1}
        pageCount={3}
        onPage={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('table', { name: 'Audit log' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Name' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(11);
  });

  it('shows Page N of M and moves with Previous and Next', async () => {
    const onPage = jest.fn();
    render(
      <PagedTable
        caption="Audit log"
        columns={columns}
        rows={rows}
        rowKey={r => String(r.id)}
        page={2}
        pageCount={3}
        onPage={onPage}
      />,
    );
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPage).toHaveBeenLastCalledWith(1);
  });

  it('keeps the controls focusable at the ends and does nothing there', async () => {
    const onPage = jest.fn();
    render(
      <PagedTable
        caption="Audit log"
        columns={columns}
        rows={rows}
        rowKey={r => String(r.id)}
        page={1}
        pageCount={1}
        onPage={onPage}
      />,
    );
    const prev = screen.getByRole('button', { name: 'Previous' });
    expect(prev).toHaveAttribute('aria-disabled', 'true');
    prev.focus();
    await userEvent.click(prev);
    expect(prev).toHaveFocus();
    expect(onPage).not.toHaveBeenCalled();
  });

  it('announces the current page politely', () => {
    render(
      <PagedTable
        caption="Audit log"
        columns={columns}
        rows={rows}
        rowKey={r => String(r.id)}
        page={1}
        pageCount={3}
        onPage={jest.fn()}
      />,
    );
    expect(screen.getByText('Page 1 of 3')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <PagedTable
        caption="Audit log"
        columns={columns}
        rows={rows}
        rowKey={r => String(r.id)}
        page={1}
        pageCount={3}
        onPage={jest.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('SectionState (BR1.2, BR6.1, BR6.3, BR7.2)', () => {
  const view = (state: State<string[]>, extra = {}) =>
    render(
      <SectionState
        state={state}
        name="Open changes"
        emptyKey="empty.open"
        onRetry={jest.fn()}
        {...extra}
      >
        {data => (
          <ul>
            {data.map(d => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </SectionState>,
    );

  it('marks the region busy and announces loading politely', () => {
    const { container } = view({ status: 'loading' });
    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading Open changes.',
    );
  });

  it('shows the data when loaded and is not busy', () => {
    const { container } = view({ status: 'loaded', data: ['a', 'b'] });
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute('aria-busy', 'false');
  });

  it('shows the empty text, never an empty area', () => {
    view({ status: 'empty' });
    expect(screen.getByText('No open changes.')).toBeInTheDocument();
  });

  it('shows the server error panel with Retry', async () => {
    const onRetry = jest.fn();
    render(
      <SectionState
        state={{ status: 'server-error' }}
        name="x"
        emptyKey="empty.plan"
        onRetry={onRetry}
      >
        {() => null}
      </SectionState>,
    );
    expect(
      screen.getByText('Guardrails server unreachable.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows error.loadFailed with Retry for a load failure', async () => {
    const onRetry = jest.fn();
    render(
      <SectionState
        state={{ status: 'load-failed' }}
        failure={{ kind: 'no-answer' }}
        name="x"
        emptyKey="empty.plan"
        onRetry={onRetry}
      >
        {() => null}
      </SectionState>,
    );
    expect(
      screen.getByText('Could not load this section.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the demo-session text for a 401, and not-found text for a 404', () => {
    const { rerender } = render(
      <SectionState
        state={{ status: 'load-failed' }}
        failure={{ kind: 'unauthenticated' }}
        name="x"
        emptyKey="empty.plan"
        onRetry={jest.fn()}
      >
        {() => null}
      </SectionState>,
    );
    expect(
      screen.getByText('Your demo session ended. Choose a demo user.'),
    ).toBeInTheDocument();
    rerender(
      <SectionState
        state={{ status: 'load-failed' }}
        failure={{ kind: 'api', code: 'NOT_FOUND', status: 404 }}
        name="x"
        emptyKey="empty.plan"
        onRetry={jest.fn()}
      >
        {() => null}
      </SectionState>,
    );
    expect(
      screen.getByText('This change no longer exists.'),
    ).toBeInTheDocument();
  });

  it('never shows the server panel text for a section that is not plan or CI', () => {
    render(
      <SectionState
        state={{ status: 'load-failed' }}
        failure={{ kind: 'server-unreachable' }}
        name="x"
        emptyKey="empty.open"
        onRetry={jest.fn()}
      >
        {() => null}
      </SectionState>,
    );
    expect(
      screen.getByText('Could not load this section.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Guardrails server unreachable.'),
    ).not.toBeInTheDocument();
  });

  it('has no accessibility violations in any state', async () => {
    for (const state of [
      { status: 'loading' },
      { status: 'empty' },
      { status: 'server-error' },
      { status: 'load-failed' },
      { status: 'loaded', data: ['a'] },
    ] as State<string[]>[]) {
      const { container, unmount } = view(state);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
});

describe('ServerErrorPanel (BR6.1)', () => {
  it('shows the text and a Retry button', async () => {
    const onRetry = jest.fn();
    render(<ServerErrorPanel onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Guardrails server unreachable.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('ResultBanner and RefusalAlert (BR3.6, BR7.2)', () => {
  it('banner is a status region that takes focus and has a dismiss button', async () => {
    const onDismiss = jest.fn();
    render(<ResultBanner messageKey="banner.approved" onDismiss={onDismiss} />);
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Change approved and applied.');
    expect(region).toHaveFocus();
    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss message' }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('banner takes focus again when the message changes', () => {
    const { rerender } = render(
      <ResultBanner messageKey="banner.approved" onDismiss={jest.fn()} />,
    );
    (document.activeElement as HTMLElement).blur();
    rerender(
      <ResultBanner messageKey="banner.rejected" onDismiss={jest.fn()} />,
    );
    expect(screen.getByRole('status')).toHaveFocus();
  });

  it('refusal alert is an announced alert that takes focus and can be dismissed', async () => {
    const onDismiss = jest.fn();
    render(
      <RefusalAlert
        messageKey="refusal.alreadyDecided"
        onDismiss={onDismiss}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This change was already decided.');
    expect(alert).toHaveFocus();
    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss message' }),
    );
    expect(onDismiss).toHaveBeenCalled();
  });

  it('have no accessibility violations', async () => {
    const { container } = render(
      <div>
        <ResultBanner messageKey="banner.proposed" onDismiss={jest.fn()} />
        <RefusalAlert messageKey="refusal.notFailed" onDismiss={jest.fn()} />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

// keep `act` imported for React 18 environments that warn without it
void act;
