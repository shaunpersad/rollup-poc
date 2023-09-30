import { ModuleResolutionHost } from 'typescript';

export type FilePath = string;
export type FileLoader = (() => Promise<string> | string);

const SYNC_FILES = ['package.json', 'package-lock.json', 'tsconfig.json', 'jsconfig.json'];

export function normalizePath(directoryOrFile: string) {
  if (directoryOrFile.endsWith('/')) {
    directoryOrFile = directoryOrFile.slice(0, -1);
  }
  if (directoryOrFile.startsWith('/')) {
    directoryOrFile = directoryOrFile.replace('/', '');
  }
  return directoryOrFile;
}

export default class Filesystem {
  protected readonly files = new Map<FilePath, FileLoader>();

  async createFile(filePath: string, loader: FileLoader) {
    const normalizedPath = normalizePath(filePath);
    const fileName = normalizedPath.split('/').pop() || '';
    if (SYNC_FILES.includes(fileName)) {
      const text = await loader();
      loader = () => text;
    }
    // console.log('[creating file]', normalizedPath);
    this.files.set(normalizedPath, loader);
  }

  readFile(filePath: string) {
    const loader = this.files.get(normalizePath(filePath));
    if (loader) {
      // console.log('[loading file]', filePath);
      return loader();
    }
    console.log('[file not found]', filePath);
    return null;
  }

  getSyncHost(): ModuleResolutionHost {
    return {
      fileExists: (filePath: string) => this.files.has(normalizePath(filePath)),
      directoryExists: (directoryPath: string) => {
        const dir = `${normalizePath(directoryPath)}/`;
        return !!Array.from(this.files.keys()).find((p) => p.startsWith(dir));
      },
      /**
       * This should only happen for package.json files
       */
      readFile: (filePath: string) => {
        const content = this.readFile(filePath);
        if (typeof content === 'string') {
          return content;
        }
        throw new Error(`Attempted to load non-synchronous file ${filePath}`);
      },
    };
  }
}
