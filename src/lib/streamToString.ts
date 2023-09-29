/**
 * Converts a stream of bytes to a string.
 */
export default async function streamToString(stream: ReadableStream<ArrayBufferView>): Promise<string> {
  const readable = stream.pipeThrough(new TextDecoderStream());
  let str = '';
  for await (const chunk of readable) {
    str += chunk;
  }
  return str;
}
