module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer|react-redux|@react-navigation|react-native-safe-area-context|react-native-screens|react-native-paper|@tanstack)(/|$))',
  ],
  // Git worktrees live under .claude/worktrees/ inside this project's own
  // tree — without these, Jest also discovers/resolves their copies of the
  // same source files, colliding with this project's own modules.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.claude/', '<rootDir>/.superpowers/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.superpowers/'],
};
