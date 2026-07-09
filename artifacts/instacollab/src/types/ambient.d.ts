declare module 'svga' {
  export class Parser {
    constructor(options?: { isDisableWebWorker?: boolean });
    load(url: string): Promise<unknown>;
    destroy(): void;
  }
  export class Player {
    constructor(options?: { container?: HTMLElement; loop?: number });
    onEnd?: () => void;
    mount(svga: unknown): Promise<void>;
    start(): void;
    stop(): void;
    clear(): void;
    destroy(): void;
  }
}
