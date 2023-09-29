import { clampedAll } from 'clamped-promise-all';
import Filesystem, { normalizePath } from '../Filesystem';
import retryableFetch from '../retryableFetch';

type PackageJson = {
  version: string,
  dependencies?: Record<string, string>,
  files?: string[],
};

type PackageLock = {
  packages?: Record<string, {
    version: string,
    resolved: string,
    dev?: boolean,
  }>
};

type UnpkgMeta = {
  path: string
} & (
  {
    type: 'directory',
    files: UnpkgMeta[],
  } |
  {
    type: 'file',
  }
);

export default class Npm {
  protected filesystem: Filesystem;

  constructor(filesystem: Filesystem) {
    this.filesystem = filesystem;
  }

  async install(parallelism = 5) {
    const exists = this.filesystem.getPackageJson();
    if (!exists) {
      console.log('no package.json file');
      return;
    }
    const { packageJson, packageLock } = exists;
    const { dependencies = {} } = JSON.parse(packageJson) as PackageJson;
    const specificVersions = new Map<string, string>(Object.entries(dependencies));
    if (packageLock) {
      const { packages = {} } = JSON.parse(packageLock) as PackageLock;
      for (const [name, info] of Object.entries(packages)) {
        if (name.startsWith('node_modules/') && !info.dev) {
          specificVersions.set(name.replace('node_modules/', ''), info.version);
        }
      }
    }
    await clampedAll(
      Array.from(specificVersions.entries()).map(
        ([lockName, version]) => async () => {
          const name = lockName.split('/node_modules/').pop() || '';
          const versionLookup = await retryableFetch(`https://unpkg.com/${name}@${version}/?meta`, {
            cf: { cacheEverything: true },
          });
          if (!versionLookup.ok) {
            throw new Error(`${versionLookup.status} ${await versionLookup.text()}`);
          }
          const specificVersion = normalizePath(new URL(versionLookup.url).pathname).split('@').pop() || 'latest';

          const packageJsonLookup = await retryableFetch(`https://ga.jspm.io/npm:${name}@${specificVersion}/package.json`, {
            cf: { cacheEverything: true },
          });
          if (!packageJsonLookup.ok) {
            console.log({ name, version, specificVersion });
            throw new Error(`${packageJsonLookup.url} ${packageJsonLookup.status} ${await packageJsonLookup.text()}`);
          }
          const jspmPackageJson = await packageJsonLookup.json<PackageJson>();
          for (const file of jspmPackageJson.files || []) {
            await this.processMeta(name, specificVersion, { path: file, type: 'file' }, `node_modules/${lockName}`);
          }
        },
      ),
      parallelism,
    );
  }

  protected async processMeta(name: string, version: string, meta: UnpkgMeta, installPath: string) {
    if (meta.type === 'file') {
      const normalizedFilePath = normalizePath(meta.path);
      // console.log(JSON.stringify({ name, version, installDir, normalizedFilePath, metaPath: meta.path }, null, 2));
      const loader = async () => {
        // const response = await retryableFetch(`https://unpkg.com/${name}@${version}/${normalizedFilePath}`, {
        //   cf: { cacheEverything: true },
        // });
        const response = await retryableFetch(`https://ga.jspm.io/npm:${name}@${version}/${normalizedFilePath}`, {
          cf: { cacheEverything: true },
        });
        if (!response.ok) {
          return '';
          // throw new Error(`${response.status} ${await response.text()}`);
        }
        return response.text();
      };
      return this.filesystem.createFile(`${installPath}/${normalizedFilePath}`, loader);
    }
    for (const subMeta of meta.files) {
      await this.processMeta(name, version, subMeta, installPath);
    }
  }
}
