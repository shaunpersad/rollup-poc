import { clampedAll } from 'clamped-promise-all';
import Filesystem, { normalizePath } from '../fs/Filesystem';
import { PackageLock } from './PackageJson';
import jspmPackageProvider from './package-providers/jspmPackageProvider';
import skypackPackageProvider from './package-providers/skypackPackageProvider';
import unpkgPackageProvider from './package-providers/unpkgPackageProvider';

export class NpmError extends Error {}

const PACKAGE_PROVIDERS = {
  jspm: jspmPackageProvider,
  skypack: skypackPackageProvider,
  unpkg: unpkgPackageProvider,
} as const;

export default class Npm {
  protected readonly filesystem: Filesystem;

  constructor(filesystem: Filesystem) {
    this.filesystem = filesystem;
  }

  async install(parallelism = 5) {
    const packageLockFile = this.filesystem.getSyncHost().readFile('package-lock.json');
    if (!packageLockFile) {
      throw new NpmError('no package-lock.json file found.');
    }
    const { packages = {} } = JSON.parse(packageLockFile) as PackageLock;
    const versionMap = new Map<string, string>();
    for (const [name, info] of Object.entries(packages)) {
      if (name.startsWith('node_modules/') && !info.dev) {
        versionMap.set(name.replace('node_modules/', ''), info.version);
      }
    }
    await clampedAll(
      Array.from(versionMap.entries()).map(
        ([dependency, version]) => async () => {
          const installPath = `node_modules/${dependency}`;
          const packageName = dependency.split('/node_modules/').pop() || '';
          const { files, provider } = await Npm.getFileList(packageName, version);
          for (const filePath of files) {
            const normalizedFilePath = normalizePath(filePath);
            await this.filesystem.createFile(
              `${installPath}/${normalizedFilePath}`,
              provider.getLoaderForFile(packageName, version, normalizedFilePath),
            );
          }
        },
      ),
      parallelism,
    );
    return versionMap;
  }

  protected static async getFileList(packageName: string, packageVersion: string) {
    for (const provider of [PACKAGE_PROVIDERS.jspm, PACKAGE_PROVIDERS.skypack, PACKAGE_PROVIDERS.unpkg]) {
      try {
        const files = await provider.getPackageFileList(packageName, packageVersion);
        return { files, provider };
      } catch (err) { /* empty */ }
    }
    throw new NpmError(`Could not get file list for ${packageName}@${packageVersion}`);
  }
}
