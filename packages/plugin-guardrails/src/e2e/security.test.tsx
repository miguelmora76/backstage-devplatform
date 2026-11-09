import { screen, waitFor, within } from '@testing-library/react';
import { GuardrailsRoutes } from '../screens/GuardrailsRoutes';
import { memoryStorage, renderScreen, setupStandIn } from '../testing/harness';
import { BACKEND, PRIYA, SAM, SERVICE } from '../testing/standIn/handlers';
import { STORAGE_KEY } from '../api/demoSession';

const standIn = setupStandIn();

const HOSTILE = '<img src=x onerror=alert(1)>';
const SCRIPT = '<script>window.hacked=1</script>';

function spyConsole() {
  const calls: unknown[][] = [];
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m =>
    jest.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      calls.push(args);
    }),
  );
  return {
    calls,
    restore: () => spies.forEach(s => s.mockRestore()),
  };
}

async function walkthrough(storage = memoryStorage()) {
  const view = renderScreen(<GuardrailsRoutes service={SERVICE} />, {
    route: '/',
    path: '/*',
    storage,
  });
  const { user } = view;
  await screen.findByText('Upgrade lib-a from 1.2 to 2.0');
  // Switch to Priya (the token appears from here on).
  await user.click(screen.getByRole('button', { name: /Switch demo user/ }));
  await user.click(await screen.findByRole('menuitem', { name: /Priya/ }));
  await waitFor(() =>
    expect(screen.getByText('Signed in as: Priya')).toBeInTheDocument(),
  );
  // Propose, open the detail, approve.
  await user.click(
    await screen.findByRole('button', { name: 'Propose change for lib-b' }),
  );
  await screen.findByTestId('result-banner');
  const sam = await screen.findByRole('link', {
    name: 'View change: Upgrade lib-a from 1.2 to 2.0',
  });
  await user.click(sam);
  await waitFor(() =>
    expect(screen.getByTestId('detail-h1')).toHaveTextContent('Upgrade lib-a'),
  );
  await user.type(screen.getByLabelText('Reason (required)'), 'Looks safe');
  await user.click(screen.getByRole('button', { name: 'Approve' }));
  await screen.findByTestId('result-banner');
  return { ...view, storage };
}

describe('security walkthrough (NFR5.2 to NFR5.6, NFR5.10)', () => {
  it('keeps the token in memory: only the userId is stored (NFR5.2)', async () => {
    const storage = memoryStorage();
    await walkthrough(storage);
    expect(storage.data).toEqual({ [STORAGE_KEY]: 'priya' });
    expect(JSON.stringify(window.sessionStorage)).not.toContain('token-');
    expect(JSON.stringify(window.localStorage)).not.toContain('token-');
    expect(document.cookie).not.toContain('token-');
  });

  it('never shows, logs or addresses the token, and sends it only to the plugin backend (NFR5.3)', async () => {
    const consoleSpy = spyConsole();
    try {
      await walkthrough();
      expect(document.body.innerHTML).not.toContain('token-priya');
      expect(JSON.stringify(consoleSpy.calls)).not.toContain('token-');
      const withAuth = standIn.state.requests.filter(
        r => r.headers.authorization,
      );
      expect(withAuth.length).toBeGreaterThan(0);
      const all = standIn.state.requests;
      for (const r of all) {
        expect(r.url).not.toContain('token-');
        expect(JSON.stringify(r.body ?? '')).not.toContain('token-');
      }
      // The credential appears only as a header to the plugin backend's address.
      expect(withAuth.every(r => r.url.startsWith(BACKEND))).toBe(true);
      expect(
        withAuth.every(r =>
          /^Bearer token-(priya|sam)$/.test(r.headers.authorization),
        ),
      ).toBe(true);
      // The start address got no credential.
      const start = all.filter(x => x.path.endsWith('/demo/start'));
      expect(start.length).toBeGreaterThan(0);
      expect(start.every(r => r.headers.authorization === undefined)).toBe(
        true,
      );
    } finally {
      consoleSpy.restore();
    }
  });

  it('sends no actor, role or user id other than the credential, the audit actor filter and the start address (NFR5.4)', async () => {
    await walkthrough();
    const all = standIn.state.requests;
    for (const r of all) {
      expect(JSON.stringify(r.body ?? '')).not.toMatch(/actor|role|userId/);
    }
    const keysOf = (r: (typeof all)[number]) => [
      ...new URLSearchParams(r.search).keys(),
    ];
    const isStart = (r: (typeof all)[number]) => r.path.endsWith('/demo/start');
    // The start address names whom to sign in as, and nothing else.
    expect(all.filter(isStart).map(keysOf)).toEqual(
      all.filter(isStart).map(() => ['userId']),
    );
    // No other request carries an actor, a role or a user id in its query
    // (the audit actor filter is only sent when the person chooses it).
    const forbidden = ['actor', 'role', 'userId'];
    expect(
      all
        .filter(r => !isStart(r))
        .flatMap(keysOf)
        .filter(k => forbidden.includes(k)),
    ).toEqual([]);
    expect(
      all
        .flatMap(r => Object.keys(r.headers))
        .filter(h => /actor|role|x-user/i.test(h)),
    ).toEqual([]);
  });

  it('sends the audit actor filter when the person chooses an actor (the one allowed exception)', async () => {
    const { user } = renderScreen(<GuardrailsRoutes service={SERVICE} />, {
      route: '/',
      path: '/*',
    });
    await screen.findByText('Page 1 of 3');
    await user.selectOptions(screen.getByLabelText('Actor'), 'priya');
    await waitFor(() =>
      expect(
        standIn.state.requests.some(
          r => r.path.endsWith('/audit') && r.search.includes('actor=priya'),
        ),
      ).toBe(true),
    );
  });

  it('shows hostile text from the backend as text and creates no element (NFR5.5)', async () => {
    standIn.state.users = [
      { ...SAM, name: HOSTILE },
      { ...PRIYA, name: SCRIPT },
      PRIYA,
    ];
    standIn.state.appUser = standIn.state.users[0];
    standIn.state.plan[0].name = HOSTILE;
    standIn.state.plan[0].dependencyKey = 'lib-a';
    standIn.state.ci[0].cause = SCRIPT;
    standIn.state.changes[0].summary = HOSTILE;
    standIn.state.changes[1].failureMessage = SCRIPT;
    standIn.state.changes[1].decisionReason = HOSTILE;
    standIn.state.audit[0].reason = HOSTILE;
    standIn.state.audit[0].target = SCRIPT;
    standIn.state.audit[1].actor = { ...PRIYA, name: HOSTILE };
    const { container, user } = renderScreen(
      <GuardrailsRoutes service={SERVICE} />,
      { route: '/', path: '/*' },
    );
    await waitFor(() =>
      expect(screen.getAllByText(HOSTILE).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(SCRIPT).length).toBeGreaterThan(0);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { hacked?: number }).hacked).toBeUndefined();
    // The detail screen too: summary, failure message, reason, names.
    standIn.state.appUser = PRIYA;
    await user.click(screen.getAllByRole('link', { name: /View change/ })[0]);
    await waitFor(() =>
      expect(screen.getByTestId('detail-h1')).toBeInTheDocument(),
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(
      within(container).getAllByText(
        new RegExp(SCRIPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      ).length,
    ).toBeGreaterThan(0);
  });

  it('encodes ids and service names with / ? # and spaces in every address (NFR5.6)', async () => {
    standIn.state.changes[0].changeId = 'c 1/x?y#z';
    const weird = 'pay/api?x#y z';
    renderScreen(<GuardrailsRoutes service={weird} />, {
      route: '/',
      path: '/*',
    });
    await screen.findByText('Upgrade lib-a from 1.2 to 2.0');
    const link = screen.getByRole('link', {
      name: 'View change: Upgrade lib-a from 1.2 to 2.0',
    });
    expect(link.getAttribute('href')).toContain(
      encodeURIComponent('c 1/x?y#z'),
    );
    for (const r of standIn.state.requests) {
      expect(r.path).not.toContain('/pay/api');
    }
    expect(
      standIn.state.requests.some(r =>
        r.path.includes(encodeURIComponent(weird)),
      ),
    ).toBe(true);
  });

  it('writes nothing to the console for a failed call, and only catalog text shows (NFR5.10)', async () => {
    const consoleSpy = spyConsole();
    try {
      standIn.state.modes.plan = 'error';
      standIn.state.modes.audit = 'network';
      renderScreen(<GuardrailsRoutes service={SERVICE} />, {
        route: '/',
        path: '/*',
      });
      await waitFor(() =>
        expect(screen.getAllByText('Could not load this section.').length).toBe(
          2,
        ),
      );
      expect(document.body.textContent).not.toMatch(
        /INTERNAL_ERROR|A fixed message|Failed to fetch|TypeError/,
      );
      expect(JSON.stringify(consoleSpy.calls)).not.toMatch(
        /INTERNAL_ERROR|A fixed message/,
      );
    } finally {
      consoleSpy.restore();
    }
  });

  it('has no use of raw-HTML insertion anywhere in the plugin source (NFR5.5)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (
          /\.(ts|tsx)$/.test(f) &&
          !/\.test\.tsx?$/.test(f) &&
          !p.includes('/testing/')
        )
          files.push(p);
      }
    };
    walk(path.resolve(__dirname, '..'));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      expect(text).not.toMatch(
        /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(/,
      );
    }
  });
});
