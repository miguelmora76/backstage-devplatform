describe('test runner', () => {
  it('runs in the pinned time zone', () => {
    expect(process.env.TZ).toBe('Europe/Berlin');
  });
});
