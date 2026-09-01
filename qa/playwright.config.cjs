module.exports = {
  testDir: '.',
  testMatch: /ui-browser\.pw\.cjs/,
  timeout: 120000,
  retries: 0,
  workers: 1,
  use: {
    browserName: 'chromium',
    headless: true,
  },
};
