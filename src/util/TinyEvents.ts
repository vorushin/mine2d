// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => void;

/**
 * Minimal event emitter. Used by Phaser-free logic modules so they can be unit-tested
 * without pulling Phaser into the test environment.
 */
export class TinyEmitter {
  private handlers: Map<string, Set<AnyHandler>> = new Map();

  on(event: string, handler: AnyHandler): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
  }

  off(event: string, handler: AnyHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) h(...args);
  }
}
