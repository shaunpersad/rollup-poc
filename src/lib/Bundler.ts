import { rollup } from '@rollup/browser';
import { CompilerOptions, ModuleResolutionKind, ScriptTarget, resolveModuleName, transpileModule } from 'typescript';
import Filesystem from './fs/Filesystem';

export default class Bundler {
  protected filesystem: Filesystem;

  constructor(filesystem: Filesystem) {
    this.filesystem = filesystem;
  }

  async bundle(entryPoint: string) {
    /**
     * Setup TypeScript "host"
     */
    const tsHost = this.filesystem.getSyncHost();
    const tsConfigText = tsHost.readFile('tsconfig.json') || tsHost.readFile('jsconfig.json');
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
          resolveId: (source, importer) => {
            // console.log('resolving', { source, importer });
            if (!importer) {
              return source;
            }
            const result = resolveModuleName(
              source,
              importer,
              compilerOptions,
              tsHost,
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
          load: async (id) => {
            // console.log('loading', id);
            const text = await this.filesystem.readFile(id);
            if (text) {
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
    return output;
  }
}
