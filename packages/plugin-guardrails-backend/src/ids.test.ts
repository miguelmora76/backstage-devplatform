import { createIdGenerator } from './ids';
import { createFakeClock } from './testing/fakeClock';

describe('id generator', () => {
  it('gives ids that sort in creation order, also within one millisecond and when the clock steps back', () => {
    const clock = createFakeClock();
    const ids = createIdGenerator(clock);
    const made: string[] = [];
    made.push(ids.changeId());
    made.push(ids.changeId());
    clock.advance(1);
    made.push(ids.changeId());
    clock.advance(-5000);
    made.push(ids.changeId());
    made.push(ids.changeId());
    expect([...made].sort()).toEqual(made);
    expect(new Set(made).size).toBe(made.length);
    expect(made[0]).toMatch(/^chg-\d{14}-\d{4}$/);
  });

  it('gives a different token each time', () => {
    const ids = createIdGenerator(createFakeClock());
    expect(ids.token()).not.toBe(ids.token());
  });
});
