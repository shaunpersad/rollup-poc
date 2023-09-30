import Tar from '../tar/Tar';
import { TAR_OBJECT_TYPE_FILE } from '../tar/TarObject';

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

export type GetFileContentsOptions = {
  owner: string,
  repo: string,
  path: string,
  ref?: string,
};

export class GithubApiError extends Error {}

export default class GitHubApi {
  protected fetch: (relativePath: string | URL, info?: RequestInit<RequestInitCfProperties>) => Promise<Response>;

  constructor(token: string) {
    this.fetch = async (relativePath, args = {}) => {
      const response = await fetch(new URL(relativePath, 'https://api.github.com'), {
        ...args,
        headers: {
          Authorization: `Bearer ${token}`,
          'X-GitHub-ApiVersion': '2022-11-28',
          'User-Agent': 'Rollup POC',
          ...args.headers,
        },
      });
      if (!response.ok) {
        throw new GithubApiError(`[${response.status}] ${response.url} : ${await response.text()}`);
      }
      return response;
    };
  }

  async getRepoFiles({ owner, repo, forEach }: GetRepoContentsOptions) {
    const response = await this.fetch(`/repos/${owner}/${repo}/tarball`);
    await Tar.extract({
      stream: response.body!,
      async forEach({ header: { type, name, size }, body }) {
        if (name && body && type === TAR_OBJECT_TYPE_FILE) {
          // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/no-unused-vars
          const [_, ...rest] = name.split('/');
          const extracted = rest.join('/');
          await forEach({ name: extracted, body, size });
        }
      },
    });
  }

  async getFileContents({ owner, repo, path, ref }: GetFileContentsOptions) {
    let url = `/repos/${owner}/${repo}/contents/${path}`;
    if (ref) {
      url += `?ref=${ref}`;
    }
    const response = await this.fetch(url, {
      headers: {
        'Content-Type': 'application/vnd.github+json',
      },
    });
    const json = await response.json<{ download_url: string, content: string }>();
    // console.log(JSON.stringify([...response.headers.entries()], null, 2));
    return atob(json.content);
    // console.log(JSON.stringify(json, null, 2));
    // const content = await fetch(json.download_url);
    // return content.text();
  }
}
