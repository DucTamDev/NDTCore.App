// __tests__/App.test.tsx
import React from 'react';
import TestRenderer from 'react-test-renderer';
import { printerManager } from '@ndtcore/printer';
import App from '../App';

let initAsync: jest.SpyInstance;

beforeEach(() => {
  // Jest không có TurboModule máy in nên initAsync thật sẽ reject PLATFORM_UNSUPPORTED.
  initAsync = jest.spyOn(printerManager, 'initAsync').mockResolvedValue();
});

afterEach(() => initAsync.mockRestore());

it('renders without crashing', () => {
  TestRenderer.act(() => {
    TestRenderer.create(<App />);
  });
});

it('mở app thì khởi động package máy in', () => {
  TestRenderer.act(() => {
    TestRenderer.create(<App />);
  });

  expect(initAsync).toHaveBeenCalledTimes(1);
});
