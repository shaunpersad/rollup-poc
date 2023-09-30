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
      removeComments: true,
    };
    const input = entryPoint;

    const bundle = await rollup({
      input,
      maxParallelFileOps: 5,
      output: {
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
          preset: 'es2015',
        },
        format: 'es',
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
              const { resolvedFileName } = result.resolvedModule;
              return {
                id: resolvedFileName,
                external: false,
                moduleSideEffects: false,
              };
            }
            console.log('external:', source, importer);
            return { id: source, external: true };
          },
          load: async (id) => {
            const text = await this.filesystem.readFile(id);
            if (text) {
              // console.log('[load]', id);
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
