export class ResourcePool {
  private textures = 0;
  private buffers = 0;
  private timers = 0;

  acquire(kind: "texture" | "buffer" | "timer"): void {
    if (kind === "texture") this.textures += 1;
    if (kind === "buffer") this.buffers += 1;
    if (kind === "timer") this.timers += 1;
  }

  release(kind: "texture" | "buffer" | "timer"): void {
    if (kind === "texture") this.textures = Math.max(0, this.textures - 1);
    if (kind === "buffer") this.buffers = Math.max(0, this.buffers - 1);
    if (kind === "timer") this.timers = Math.max(0, this.timers - 1);
  }

  snapshot() {
    return { textures: this.textures, buffers: this.buffers, timers: this.timers };
  }

  disposeAll(): void {
    this.textures = 0;
    this.buffers = 0;
    this.timers = 0;
  }
}
