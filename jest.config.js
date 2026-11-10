module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer|react-redux|@react-navigation|react-native-safe-area-context|react-native-screens|react-native-paper|@tanstack|@ndtcore)(/|$))',
  ],
  // Git worktrees live under .claude/worktrees/ inside this project's own
  // tree — without these, Jest also discovers/resolves their copies of the
  // same source files, colliding with this project's own modules.
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.claude/',
    '<rootDir>/.superpowers/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.superpowers/'],
  // Package máy in nằm ngoài App (file:../NDTCore.Package) và có node_modules riêng; singleton phải lấy từ App, nếu không
  // sẽ có hai bản react (hook lỗi) và mock ở jest.setup.js không áp lên package.
  moduleNameMapper: {
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^react-native/(.*)$': '<rootDir>/node_modules/react-native/$1',
    '^react-native-mmkv$': '<rootDir>/node_modules/react-native-mmkv',
    '^react-native-view-shot$': '<rootDir>/node_modules/react-native-view-shot',
    '^@ndtcore/printer-native$': '<rootDir>/node_modules/@ndtcore/printer-native',
  },
};
