type Listener = () => void;

let listeners: Listener[] = [];

export const onSessionExpired = (listener: Listener): (() => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};

export const emitSessionExpired = (): void => {
  listeners.forEach((listener) => listener());
};
