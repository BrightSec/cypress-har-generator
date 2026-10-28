/**
 * Joins the small chunks of a text into ones of about the given size, while passing a larger chunk on as is,
 * so writing the text takes fewer system calls without copying a large chunk.
 */
export class CoalescedChunks implements AsyncIterable<string> {
  constructor(
    private readonly chunks: AsyncIterable<string>,
    private readonly size: number = 64 * 1024
  ) {}

  public async *[Symbol.asyncIterator](): AsyncIterator<string> {
    let pending = '';

    for await (const chunk of this.chunks) {
      const large: boolean = chunk.length >= this.size;

      if (large && pending) {
        yield pending;
        pending = '';
      }

      if (large) {
        yield chunk;
        continue;
      }

      pending += chunk;

      if (pending.length >= this.size) {
        yield pending;
        pending = '';
      }
    }

    if (pending) {
      yield pending;
    }
  }
}
