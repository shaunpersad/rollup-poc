// eslint-disable-next-line max-classes-per-file
export class StorageProviderObjectNotFoundError extends Error {
  constructor(hash: string, message = `Object at ${hash} not found.`) {
    super(message);
  }
}

export default abstract class StorageProvider {
  abstract get(hash: string): Promise<ReadableStream<ArrayBufferView>>;
  abstract set(hash: string, body: ReadableStream<ArrayBufferView>, size: number): Promise<void>;
  static async streamToString(stream: ReadableStream<ArrayBufferView>): Promise<string> {
    let str = '';
    for await (const chunk of stream.pipeThrough(new TextDecoderStream())) {
      str += chunk;
    }
    return str;
  }
}
