import { TarParserChunk } from './TarParser';

export default class TarChunker {
  protected buffer = new Uint8Array(512);

  protected bufferIndex = 0;

  protected bufferIsEmpty = true;

  chunk() {
    return new TransformStream<ArrayBufferView, TarParserChunk>({
      transform: async (view, controller) => {
        const chunk = view instanceof Uint8Array
          ? view
          : new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        let chunkIndex = 0;
        while (this.bufferIndex < 512 && chunkIndex < chunk.length) {
          this.bufferIsEmpty = this.bufferIsEmpty && chunk[chunkIndex] === 0;
          this.buffer[this.bufferIndex++] = chunk[chunkIndex++];
          if (this.bufferIndex === 512) {
            // console.log(Array.from(this.buffer));
            // console.log('sending chunk', this.bufferIsEmpty);
            controller.enqueue({ chunk: this.buffer, isEmpty: this.bufferIsEmpty });
            this.buffer = new Uint8Array(512);
            this.bufferIndex = 0;
            this.bufferIsEmpty = true;
          }
        }
      },
    });
  }
}
