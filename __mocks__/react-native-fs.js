// Jest auto-applies any `<rootDir>/__mocks__/<module>.js` for a node_modules
// import, for every test file, without each one needing its own
// `jest.mock('react-native-fs', ...)`.
//
// Needed project-wide (not just for TsplFontManager's own tests) because the
// real package ships untranspiled Flow syntax (`FS.common.js`) that isn't in
// this project's Jest `transformIgnorePatterns` allowlist — any test that
// transitively imports `TsplDriver.ts` (which now imports `TsplFontManager.ts`,
// which imports `react-native-fs`) would otherwise crash at parse time with
// "Unexpected token ':'", even if that test never touches font installation.
//
// `readFileAssets` is the only method this codebase actually calls
// (TsplFontManager.ts) — stubbed as a bare jest.fn() so tests that don't care
// about it just get `undefined` back instead of a real filesystem call.
module.exports = {
  readFileAssets: jest.fn(),
};
