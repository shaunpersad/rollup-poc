export default class Queue {
  protected maxParallelism: number;

  protected currentParallelism = 0;

  protected queue: Array<() => Promise<void>> = [];

  constructor(maxParallelism: number) {
    this.maxParallelism = maxParallelism;
  }

  enqueue<Result>(item: () => Promise<Result>): Promise<Result> {
    return new Promise<Result>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await item();
          resolve(result);
        } catch (err) {
          reject(err);
        }
        this.currentParallelism--;
        this.consume();
      });
      this.consume();
    });
  }

  protected consume() {
    while ((this.currentParallelism < this.maxParallelism) && this.queue.length) {
      this.currentParallelism++;
      const next = this.queue.shift();
      next?.();
    }
  }
}
