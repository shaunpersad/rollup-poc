import { rollup } from '@rollup/browser';
import { ModuleResolutionHost, ModuleResolutionKind, resolveModuleName } from 'typescript';
import Filesystem from './lib/Filesystem';
import GitHubApi from './lib/git/GitHubApi';
import Npm from './lib/npm/Npm';

export interface Env {
  GITHUB_TOKEN: string,
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  FILES: R2Bucket;
  //
  // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
  // MY_SERVICE: Fetcher;
  //
  // Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
  // MY_QUEUE: Queue;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const filesystem = new Filesystem(env);
    const npm = new Npm(filesystem);

    /**
     * Perform the equivalent of "git pull"
     */
    const githubParams = {
      owner: 'shaunpersad',
      repo: 'rollup-poc',
      // repo: 'tar-test',
      // ref: 'ccefb38',
    };
    const github = new GitHubApi(env.GITHUB_TOKEN);
    await github.getRepoFiles({
      ...githubParams,
      forEach: async ({ name, body }) => {
        // console.log(name);
        await filesystem.createFile(name, body);
      },
    });
    await github.getRepoFiles({
      ...githubParams,
      forEach: async ({ name, body, size }) => {
        await filesystem.persistFile(name, body, size);
      },
    });

    /**
     * Perform the equivalent of "npm install"
     */
    await npm.install();
    console.log('files', JSON.stringify([...filesystem.hashes], null, 2));

    /**
     * Setup TypeScript "host"
     */
    const host: ModuleResolutionHost = {
      fileExists(fileName: string) {
        console.log('looking for', fileName);
        return filesystem.fileExists(fileName);
      },
      // readFile function is used to read arbitrary text files on disk, i.e. when resolution procedure needs the content of 'package.json'
      // to determine location of bundled typings for node module
      readFile(fileName: string) {
        console.log('reading', fileName);
        if (fileName === 'package.json' || fileName.endsWith('/package.json')) {
          const loader = filesystem.getPackageJson(fileName.slice(0, 'package.json'.length * -1));
          return loader?.packageJson;
        }
        return undefined;
      },
      trace(s: string) {
        console.log('tracing', s);
      },
      directoryExists(directoryName: string) {
        console.log('directory check', directoryName);
        return filesystem.directoryExists(directoryName);
      },
    };

    const bundle = await rollup({
      input: 'src/index.js',
      plugins: [
        {
          name: 'loader',
          resolveId(source, importer) {
            if (!importer) {
              return source;
            }
            const result = resolveModuleName(
              source,
              importer,
              {
                allowJs: true,
                moduleResolution: ModuleResolutionKind.Node16,
                resolveJsonModule: true,
                noDtsResolution: true,
                esModuleInterop: true,
              },
              host,
            );
            if (result.resolvedModule) {
              return result.resolvedModule.resolvedFileName;
            }
          },
          load(id) {
            const loader = filesystem.files.get(id);
            if (loader) {
              return loader();
            }
          },
        },
      ],
    });
    const output = await bundle.generate({ format: 'es' });

    return new Response(JSON.stringify(output, null, 2));
  },
};
