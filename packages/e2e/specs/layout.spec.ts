import { expect, test, type Page } from '@playwright/test';
import { waitForHealthyStack } from './support/healthy';
import {
  prepareChanges,
  settingsView,
  views,
  type Prepared,
} from './support/screens';

// FR3.1: none of the six views has content clipped at the right edge or a
// horizontal page scroll at 1024, 1308 and 1440 pixels, in Chrome and Firefox.
// The check looks at the page itself (its scroll width) and at every element:
// one whose right edge is past the window is a failure unless it sits inside a
// box that scrolls or clips on purpose (a table in its own scroll area).
const WIDTHS = [1024, 1308, 1440];
const HEIGHT = 900;

const state: { prepared?: Prepared } = {};
test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:7007',
  });
  await waitForHealthyStack(request);
  state.prepared = await prepareChanges(request);
  await request.dispose();
});

interface Overflow {
  pageScrollWidth: number;
  windowWidth: number;
  clipped: string[];
}

async function measure(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const windowWidth = document.documentElement.clientWidth;
    const scrolls = (element: Element | null) => {
      for (
        let el = element;
        el && el !== document.body;
        el = el.parentElement
      ) {
        const { overflowX } = window.getComputedStyle(el);
        if (
          overflowX === 'auto' ||
          overflowX === 'scroll' ||
          overflowX === 'hidden'
        ) {
          return true;
        }
      }
      return false;
    };
    const clipped: string[] = [];
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.right > windowWidth + 1 && !scrolls(element.parentElement)) {
        const id = element.id ? `#${element.id}` : '';
        const cls =
          typeof element.className === 'string' && element.className
            ? `.${element.className.split(' ')[0]}`
            : '';
        clipped.push(`${element.tagName.toLowerCase()}${id}${cls}`);
      }
    }
    return {
      pageScrollWidth: document.documentElement.scrollWidth,
      windowWidth,
      clipped: clipped.slice(0, 5),
    };
  });
}

// The catalog list shows each name on one line (no word broken in the middle)
// and has no table with its own sideways scrollbar.
for (const width of WIDTHS) {
  test(`catalog list names stay whole and the table does not scroll sideways at ${width} pixels`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: HEIGHT });
    const view = views(state.prepared!).find(v => v.name === 'catalog list')!;
    await view.show(page);
    const result = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('table a'),
      ).filter(a => /^[a-z]+(-[a-z]+)+$/.test(a.textContent ?? ''));
      const broken = links
        .filter(a => a.getClientRects().length > 1)
        .map(a => a.textContent);
      const scrolling = Array.from(document.querySelectorAll('*'))
        .filter(el => {
          const { overflowX } = window.getComputedStyle(el);
          return (
            (overflowX === 'auto' || overflowX === 'scroll') &&
            el.scrollWidth > el.clientWidth + 1 &&
            el.querySelector('table') !== null
          );
        })
        .map(
          el =>
            `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${el.scrollWidth}>${el.clientWidth}`,
        );
      return { names: links.length, broken, scrolling };
    });
    expect(result.names).toBeGreaterThanOrEqual(6);
    expect(result.broken).toEqual([]);
    expect(result.scrolling).toEqual([]);
  });
}

for (const name of [
  'sign-in choices',
  'catalog list',
  'service overview',
  'changes list',
  'change detail',
  'audit log',
  'settings',
]) {
  for (const width of WIDTHS) {
    test(`${name} fits a ${width} pixel window`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      const view = [...views(state.prepared!), settingsView].find(
        v => v.name === name,
      )!;
      await view.show(page);
      const overflow = await measure(page);
      expect(overflow.pageScrollWidth).toBeLessThanOrEqual(
        overflow.windowWidth,
      );
      expect(overflow.clipped).toEqual([]);
    });
  }
}
