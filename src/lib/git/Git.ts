import createHash from '../createHash';
import Filesystem from '../fs/Filesystem';
// import Storage from '../fs/Storage';
import GitHubApi from './GitHubApi';

export type GitPullArgs = {
  token: string,
  owner: string,
  repo: string,
  ref?: string
};

export default class Git {
  protected readonly filesystem: Filesystem;

  // protected readonly storage: Storage;

  constructor(filesystem: Filesystem) {
    this.filesystem = filesystem;
    // this.storage = storage;
  }

  async pull({ token, owner, repo, ref }: GitPullArgs) {
    const githubParams = { owner, repo, ref };
    const github = new GitHubApi(token);
    const localFileHashes = new Map<string, string>();
    await github.getRepoFiles({
      ...githubParams,
      forEach: async ({ name, body }) => {
        const hash = await createHash(body);
        localFileHashes.set(name, hash);
        await this.filesystem.createFile(
          name,
          async () => github.getFileContents({ owner, repo, path: name, ref }),
        );
      },
    });
    // await github.getRepoFiles({
    //   ...githubParams,
    //   forEach: async ({ name, body, size }) => {
    //     const hash = localFileHashes.get(name);
    //     if (!hash) {
    //       return;
    //     }
    //     await this.storage.set(hash, body, size);
    //     await this.filesystem.createFile(name, async () => {
    //       const content = await this.storage.get(hash);
    //       return Storage.streamToString(content);
    //     });
    //   },
    // });
  }
}
