import React from 'react';
import { Text, View } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { CAPTURE_TIMEOUT_MS, usePrintImageCapture, type CaptureImage } from '../usePrintImageCapture';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperType } from '../../models/paper/PaperType';
import type { PaperOptions } from '../../models/paper/PaperOptions';

const paper: PaperOptions = { type: PaperType.Continuous, paperSize: 58, cutterMode: CutterMode.PerJob };

/** Component chứa khung chụp, đưa `captureImage` ra ngoài cho test gọi. */
const Host: React.FC<{ onReady: (capture: CaptureImage) => void }> = ({ onReady }) => {
  const { captureNode, captureImage } = usePrintImageCapture();
  onReady(captureImage);
  return <View>{captureNode}</View>;
};

const mountHost = (): { renderer: ReactTestRenderer; capture: CaptureImage } => {
  let capture: CaptureImage | undefined;
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<Host onReady={(next) => (capture = next)} />);
  });
  return { renderer: renderer as ReactTestRenderer, capture: capture as CaptureImage };
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('usePrintImageCapture', () => {
  it('khung chụp layout xong thì trả ảnh', async () => {
    const { renderer, capture } = mountHost();
    let result: Promise<string | null> | undefined;
    act(() => {
      result = capture(<Text>bill</Text>, paper);
    });

    await act(async () => {
      renderer.root.findByProps({ collapsable: false }).props.onLayout();
    });

    await expect(result).resolves.toBe('file://mock-capture.png');
  });

  it('component bị unmount giữa lúc chụp thì trả null thay vì treo', async () => {
    const { renderer, capture } = mountHost();
    let result: Promise<string | null> | undefined;
    act(() => {
      result = capture(<Text>bill</Text>, paper);
    });

    act(() => renderer.unmount());

    await expect(result).resolves.toBeNull();
  });

  it('khung chụp không layout được trong thời hạn thì trả null', async () => {
    const { capture } = mountHost();
    let result: Promise<string | null> | undefined;
    act(() => {
      result = capture(<Text>bill</Text>, paper);
    });

    act(() => {
      jest.advanceTimersByTime(CAPTURE_TIMEOUT_MS);
    });

    await expect(result).resolves.toBeNull();
  });
});
