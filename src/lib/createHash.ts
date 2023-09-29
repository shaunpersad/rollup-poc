export default async function createHash(body: ReadableStream<Uint8Array>) {
  const digestStream = new crypto.DigestStream('SHA-256');
  // await body.pipeTo(digestStream); // todo why doesn't this work?
  const writer = digestStream.getWriter();
  for await (const chunk of body) {
    await writer.ready;
    await writer.write(chunk);
  }
  await writer.ready;
  await writer.close();
  const digest = await digestStream.digest;
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
