import TarChunker from '../tar/TarChunker';
import TarExtender from '../tar/TarExtender';
import { TAR_OBJECT_TYPE_FILE, TarObject } from '../tar/TarObject';
import TarParser from '../tar/TarParser';

export type RepoFile = {
  name: string,
  body: ReadableStream<Uint8Array>,
  size: number,
};

export type GetRepoContentsOptions = {
  owner: string,
  repo: string,
  ref?: string,
  forEach: (file: RepoFile) => void | Promise<void>,
};

export default class GitHubApi {
  protected token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getRepoFiles({ owner, repo, ref, forEach }: GetRepoContentsOptions) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/tarball`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-ApiVersion': '2022-11-28',
        'User-Agent': 'Rollup POC',
      },
    });
    if (response.ok && response.body) {
      const chunker = new TarChunker();
      const parser = new TarParser();
      const extender = new TarExtender();
      await response.body
        .pipeThrough(new DecompressionStream('gzip'))
        .pipeThrough(chunker.chunk())
        .pipeThrough(parser.parse())
        .pipeThrough(extender.extend())
        .pipeTo(new WritableStream<TarObject>({
          async write({ header: { type, name, size, attrs }, body }: TarObject) {
            // console.log(JSON.stringify({ type, name, size }, null, 2));
            if (name && body && type === TAR_OBJECT_TYPE_FILE) {
              const [_, ...rest] = name.split('/');
              const extracted = rest.join('/');
              await forEach({ name: extracted, body, size });
            }
          },
        }));
    }
  }
}
