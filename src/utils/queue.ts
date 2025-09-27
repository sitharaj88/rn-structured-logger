/**
 * A simple asynchronous batching queue. Items pushed onto the queue are stored
 * until the batch reaches the configured size or the specified interval passes.
 * When a flush occurs, all queued items are passed to the provided flush
 * function. If a flush is in progress, additional flushes are skipped until
 * completion.
 */
export class AsyncBatchQueue<T> {
  private buffer: T[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  /**
   * Creates a new batch queue.
   * @param batchSize - Maximum items per batch
   * @param intervalMs - Maximum time in milliseconds to wait before flushing
   * @param flushFn - Function called with batched items
   */
  constructor(
    private readonly batchSize: number,
    private readonly intervalMs: number,
    private readonly flushFn: (items: T[]) => Promise<void> | void
  ) {}

  /**
   * Adds an item to the queue. Triggers flush if batch size is reached.
   * @param item - The item to add
   */
  push(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length >= this.batchSize) {
      this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.intervalMs);
    }
  }

  /**
   * Immediately flushes all queued items to the flush function.
   * @returns A promise that resolves when flushing is complete
   */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // avoid concurrent flushes
    if (this.flushing) return;
    if (this.buffer.length === 0) return;
    this.flushing = true;
    const items = this.buffer.splice(0, this.buffer.length);
    try {
      await this.flushFn(items);
    } finally {
      this.flushing = false;
    }
  }
}