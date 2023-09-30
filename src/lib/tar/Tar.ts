import TarChunker from './TarChunker';
import TarExtender from './TarExtender';
import { TarObject } from './TarObject';
import TarParser from './TarParser';

export type TarExtractOptions = {
  stream: ReadableStream<ArrayBufferView>,
  forEach: (obj: TarObject) => void | Promise<void>,
  compression?: 'gzip' | 'deflate' | 'deflate-raw',
};

export default class Tar {
  static async extract({ stream, forEach, compression = 'gzip' }: TarExtractOptions) {
    const chunker = new TarChunker();
    const parser = new TarParser();
    const extender = new TarExtender();
    await stream
      .pipeThrough(new DecompressionStream(compression))
      .pipeThrough(chunker.chunk())
      .pipeThrough(parser.parse())
      .pipeThrough(extender.extend())
      .pipeTo(new WritableStream<TarObject>({
        async write(obj) {
          await forEach(obj);
        },
      }));
  }
}
