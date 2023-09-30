import { Env } from '../../../types';
import StorageProvider, { StorageProviderObjectNotFoundError } from '../StorageProvider';

export default class R2StorageProvider implements StorageProvider {
  protected env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async get(hash: string): Promise<ReadableStream<ArrayBufferView>> {
    const obj = await this.env.FILES.get(hash);
    if (obj) {
      return obj.body;
    }
    throw new StorageProviderObjectNotFoundError(hash);
  }

  async set(hash: string, body: ReadableStream<ArrayBufferView>, size: number): Promise<void> {
    const exists = await this.env.FILES.head(hash);
    if (!exists) {
      await this.env.FILES.put(hash, body.pipeThrough(new FixedLengthStream(size)), {
        sha256: hash,
        httpMetadata: {
          cacheControl: 'public, max-age=31536000, s-maxage=31536000, immutable',
        },
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const chunk of body) {
        // spin
      }
    }
  }
}
