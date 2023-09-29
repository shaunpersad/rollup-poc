import { rollup } from '@rollup/browser';
import {
  CompilerOptions,
  ModuleResolutionHost,
  ModuleResolutionKind,
  ScriptTarget,
  resolveModuleName,
  transpileModule,
} from 'typescript';
import Filesystem from './lib/Filesystem';
import createHash from './lib/createHash';
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const filesystem = new Filesystem();
    const npm = new Npm(filesystem);

    /**
     * Perform the equivalent of "git pull"
     */
    const githubParams = {
      owner: 'shaunpersad',
      // repo: 'throttled-queue',
      repo: 'marketwatchlist.io',
      // repo: 'tar-test',
      // ref: 'ccefb38',
    };
    const entryPoint = 'src/server.ts';
    const github = new GitHubApi(env.GITHUB_TOKEN);
    const localFileHashes = new Map<string, string>();
    await github.getRepoFiles({
      ...githubParams,
      forEach: async ({ name, body }) => {
        const hash = await createHash(body);
        localFileHashes.set(name, hash);
      },
    });
    await github.getRepoFiles({
      ...githubParams,
      forEach: async ({ name, body, size }) => {
        const hash = localFileHashes.get(name);
        if (!hash) {
          return;
        }
        const exists = await env.FILES.head(hash);
        if (!exists) {
          await env.FILES.put(hash, body.pipeThrough(new FixedLengthStream(size)), {
            sha256: hash,
            httpMetadata: {
              cacheControl: 'public, max-age=31536000, s-maxage=31536000, immutable',
            },
          });
        }
        const loader = async () => {
          const obj = await env.FILES.get(hash);
          if (!obj) {
            throw new Error(`Expected object ${hash} to be saved.`);
          }
          let str = '';
          for await (const chunk of obj.body.pipeThrough(new TextDecoderStream())) {
            str += chunk;
          }
          return str;
        };
        await filesystem.createFile(name, loader);
      },
    });

    /**
     * Perform the equivalent of "npm install"
     */
    await npm.install();
    // console.log('files', JSON.stringify([...filesystem.hashes], null, 2));

    /**
     * Setup TypeScript "host"
     */
    const host: ModuleResolutionHost = {
      fileExists(fileName: string) {
        // console.log('looking for', fileName);
        return filesystem.fileExists(fileName);
      },
      // readFile function is used to read arbitrary text files on disk, i.e. when resolution procedure needs the content of 'package.json'
      // to determine location of bundled typings for node module
      readFile(fileName: string) {
        // console.log('reading', fileName);
        if (fileName === 'package.json' || fileName.endsWith('/package.json')) {
          const loader = filesystem.getPackageJson(fileName.slice(0, 'package.json'.length * -1));
          return loader?.packageJson;
        }
        throw new Error(`Resolver attempted to load ${fileName}`);
      },
      trace(s: string) {
        console.log('tracing', s);
      },
      directoryExists(directoryName: string) {
        // console.log('directory check', directoryName);
        return filesystem.directoryExists(directoryName);
      },
    };
    const tsConfigLoader = filesystem.files.get('tsconfig.json') || filesystem.files.get('jsconfig.json');
    const tsConfigText = tsConfigLoader ? await tsConfigLoader() : '';
    const tsConfig = tsConfigText ? JSON.parse(tsConfigText) : {};
    const compilerOptions: CompilerOptions = {
      ...tsConfig.compilerOptions,
      allowJs: true,
      moduleResolution: ModuleResolutionKind.NodeNext,
      resolveJsonModule: true,
      esModuleInterop: true,
      target: ScriptTarget.ESNext,
      lib: ['esnext'],
      customConditions: ['worker', 'browser', 'esm', 'import', 'module'],
      sourceMap: false,
      declaration: false,
      noDtsResolution: true,
    };

    // todo: https://rollupjs.org/configuration-options/#output-manualchunks
    const bundle = await rollup({
      input: entryPoint,
      maxParallelFileOps: 5,
      output: {
        generatedCode: {
          constBindings: true,
        },
      },
      plugins: [
        {
          name: 'loader',
          resolveId(source, importer) {
            // console.log('resolving', { source, importer });
            if (!importer) {
              return source;
            }
            const result = resolveModuleName(
              source,
              importer,
              compilerOptions,
              host,
            );
            if (result.resolvedModule) {
              // console.log(result.resolvedModule);
              return {
                id: result.resolvedModule.resolvedFileName,
                external: false,
              };
            }
            console.log('external:', source, importer);
            return { id: source, external: true };
            // console.error(JSON.stringify(result, null, 2));
            // throw new Error(`could not resolve module source: ${source}, importer: ${importer}`);
          },
          async load(id) {
            // console.log('loading', id);
            const loader = filesystem.files.get(id);
            if (loader) {
              const text = await loader();
              const result = transpileModule(text, {
                compilerOptions,
                fileName: id,
              });
              return result.outputText;
            }
            console.error(JSON.stringify(id, null, 2));
            throw new Error('could not load module');
          },
        },
      ],
    });
    const { output } = await bundle.generate({ format: 'es' });

    return new Response(JSON.stringify({ ...output, size: output[0].code.length }, null, 2), {
      headers: {
        'content-type': 'application/json',
      },
    });
  },
};
