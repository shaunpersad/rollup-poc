import Bundler from './lib/Bundler';
import Filesystem from './lib/fs/Filesystem';
import Git from './lib/git/Git';
import Npm from './lib/npm/Npm';
import { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const filesystem = new Filesystem();
    const git = new Git(filesystem);
    const npm = new Npm(filesystem);
    const bundler = new Bundler(filesystem);

    /**
     * Get repo contents
     */
    await git.pull({
      token: env.GITHUB_TOKEN,
      owner: 'shaunpersad',
      // repo: 'stockalerter.io-worker',
      repo: 'marketwatchlist.io',
    });

    /**
     * Get all dependencies
     */
    await npm.install();

    /**
     * Bundle it all together
     */
    const output = await bundler.bundle('src/server.ts');

    return new Response(JSON.stringify({ ...output, size: output[0].code.length }, null, 2), {
      headers: {
        'content-type': 'application/json',
      },
    });
  },
};
