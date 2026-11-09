// NFR7.1: the same data gives the same screens every run. Jest gives each test
// file a copy of process.env, so a time zone set inside a test setup file does
// not reach the real process. This runs once in the real process before any
// test worker starts, so every worker inherits the pinned zone.
module.exports = async () => {
  process.env.TZ = 'Europe/Berlin';
};
