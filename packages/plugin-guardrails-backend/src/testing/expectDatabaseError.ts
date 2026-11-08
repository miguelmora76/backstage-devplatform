/**
 * Asserts that a database statement is refused, by looking at the rejection
 * itself. Jest's `rejects.toThrow` can miss a database error when several test
 * files run in one process (a single worker, as on a two-core CI machine),
 * because the native SQLite driver is loaded once and builds its errors in the
 * first test file's realm, so `toThrow` no longer sees them as errors.
 */
export async function expectDatabaseError(
  statement: PromiseLike<unknown>,
  message?: RegExp,
): Promise<void> {
  let rejection: unknown;
  let refused = false;
  try {
    await statement;
  } catch (error) {
    refused = true;
    rejection = error;
  }
  if (!refused) {
    throw new Error('Expected the database to refuse the statement');
  }
  if (message) {
    const text =
      rejection !== null && typeof rejection === 'object'
        ? String((rejection as { message?: unknown }).message)
        : String(rejection);
    if (!message.test(text)) {
      throw new Error(
        `Expected the database error to match ${message}, got: ${text}`,
      );
    }
  }
}
