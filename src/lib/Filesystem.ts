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
  readonly files = new Map<FilePath, FileLoader>();

  async createFile(path: string, loader: FileLoader) {
    const normalizedPath = normalizePath(path);
    const fileName = normalizedPath.split('/').pop() || '';
    if (SYNC_FILES.includes(fileName)) {
      const text = await loader();
      loader = () => text;
    }
    this.files.set(normalizedPath, loader);
  }

  fileExists(path: string) {
    return this.files.has(normalizePath(path));
  }

  directoryExists(path: string) {
    const dir = `${normalizePath(path)}/`;
    return !!Array.from(this.files.keys()).find((p) => p.startsWith(dir));
  }

  getPackageJson(dir = '/') {
    const normalizedDirectory = normalizePath(dir);
    const normalizedPackageJsonPath = normalizePath(`${normalizedDirectory}/package.json`);
    const normalizedPackageLockPath = normalizePath(`${normalizedDirectory}/package-lock.json`);
    const packageJsonLoader = this.files.get(normalizedPackageJsonPath);
    const packageLockLoader = this.files.get(normalizedPackageLockPath);
    if (!packageJsonLoader) {
      return null;
    }
    return {
      packageJson: packageJsonLoader() as string,
      packageLock: packageLockLoader ? packageLockLoader() as string : null,
    };
  }
}
