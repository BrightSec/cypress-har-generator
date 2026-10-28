/**
 * Items kept in the order they started, so the one running at a given time is found by a binary search.
 */
export class StartOrder<T extends { startedAt: number }> {
  private readonly sorted: T[] = [];

  constructor(items: Iterable<T> = []) {
    for (const item of items) {
      this.insert(item);
    }
  }

  get items(): readonly T[] {
    return this.sorted;
  }

  /**
   * Adds the item after the ones that started by its time, which appends it when it started last, as it usually does.
   */
  public insert(item: T): void {
    this.sorted.splice(this.indexAt(item.startedAt) + 1, 0, item);
  }

  /**
   * The index of the last item that started by the given time, or -1 when none did.
   */
  public indexAt(time: number): number {
    let low = 0;
    let high: number = this.sorted.length - 1;
    let found = -1;

    while (low <= high) {
      const middle: number = Math.floor((low + high) / 2);

      if (this.sorted[middle].startedAt <= time) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return found;
  }
}
