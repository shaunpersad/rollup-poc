import TarParser from './TarParser';
import { TarObjectCallback } from './TarObject';
import TarExtender from './TarExtender';

export default class TarDecoder {
	protected buffer = new Uint8Array(512);
	protected bufferIndex = 0;
	protected bufferIsEmpty = true;

	async decode(stream: ReadableStream<ArrayBufferView>, forEach: TarObjectCallback) {
		let p = Promise.resolve();
		const extender = new TarExtender(forEach);
		const parser = new TarParser(async (obj) => {
			await p;
			p = extender.extend(obj);
		});

		for await (const view of stream) {
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
					await parser.parse({ chunk: this.buffer, isEmpty: this.bufferIsEmpty });
					this.buffer = new Uint8Array(512);
					this.bufferIndex = 0;
					this.bufferIsEmpty = true;
				}
			}
		}
	}
}
