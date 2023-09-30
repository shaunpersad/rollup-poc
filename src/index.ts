import Bundler from './lib/Bundler';
import Filesystem from './lib/fs/Filesystem';
import Git from './lib/git/Git';
import Npm from './lib/npm/Npm';
import { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const filesystem = new Filesystem();

    /**
     * Get repo contents
     */
    await new Git(filesystem).pull({
      token: env.GITHUB_TOKEN,
      owner: 'shaunpersad',
      // repo: 'stockalerter.io-worker',
      repo: 'marketwatchlist.io',
    });

    /**
     * Get all dependencies
     */
    await new Npm(filesystem).install();

    /**
     * Bundle it all together
     */
    const output = await new Bundler(filesystem).bundle('src/server.ts');

    return new Response(JSON.stringify({ ...output, size: output[0].code.length }, null, 2), {
      headers: {
        'content-type': 'application/json',
      },
    });
  },
};
