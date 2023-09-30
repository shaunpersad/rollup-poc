import { clampedAll } from 'clamped-promise-all';
import Filesystem, { normalizePath } from '../fs/Filesystem';
import retryableFetch from '../retryableFetch';

type PackageJson = {
  version: string,
  dependencies?: Record<string, string>,
  files?: string[],
};

export type PackageLock = {
  packages?: Record<string, {
    version: string,
    resolved: string,
    dev?: boolean,
  }>
};

export class NpmError extends Error {}

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
    const specificVersions = new Map<string, string>();
    for (const [name, info] of Object.entries(packages)) {
      if (name.startsWith('node_modules/') && !info.dev) {
        specificVersions.set(name.replace('node_modules/', ''), info.version);
      }
    }
    await clampedAll(
      Array.from(specificVersions.entries()).map(
        ([lockName, version]) => async () => {
          const name = lockName.split('/node_modules/').pop() || '';
          const packageJsonLookup = await retryableFetch(`https://ga.jspm.io/npm:${name}@${version}/package.json`, {
            cf: { cacheEverything: true },
          });
          if (!packageJsonLookup.ok) {
            throw new NpmError(`${packageJsonLookup.url} ${packageJsonLookup.status} ${await packageJsonLookup.text()}`);
          }
          const jspmPackageJson = await packageJsonLookup.json<PackageJson>();
          for (const filePath of jspmPackageJson.files || []) {
            await this.processMeta(name, version, filePath, `node_modules/${lockName}`);
          }
        },
      ),
      parallelism,
    );
  }

  protected async processMeta(name: string, version: string, filePath: string, installPath: string) {
    const normalizedFilePath = normalizePath(filePath);
    const loader = async () => {
      const response = await retryableFetch(`https://ga.jspm.io/npm:${name}@${version}/${normalizedFilePath}`, {
        cf: { cacheEverything: true },
      });
      if (!response.ok) {
        throw new NpmError(`Could not fetch ${name} ${version} ${filePath}: ${response.status} ${await response.text()}`);
      }
      return response.text();
    };
    return this.filesystem.createFile(`${installPath}/${normalizedFilePath}`, loader);
  }
}
