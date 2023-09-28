import Filesystem, { normalizePath } from '../Filesystem';

type PackageJson = {
  version: string,
  dependencies?: Record<string, string>,
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

  async install() {
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
    for (const [name, version] of specificVersions) {
      const response = await fetch(`https://unpkg.com/${name}@${version}/?meta`, {
        cf: { cacheEverything: true },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${await response.text()}`);
      }
      const specificVersion = normalizePath(new URL(response.url).pathname).split('@').pop() || 'latest';
      const meta = await response.json<UnpkgMeta>();
      await this.processMeta(name, specificVersion, meta, `node_modules/${name}`);
    }
  }

  protected async processMeta(name: string, version: string, meta: UnpkgMeta, installDir: string) {
    if (meta.type === 'file') {
      const normalizedFilePath = normalizePath(meta.path);
      // console.log(JSON.stringify({ name, version, installDir, normalizedFilePath, metaPath: meta.path }, null, 2));
      const loader = async () => {
        const response = await fetch(`https://unpkg.com/${name}@${version}/${normalizedFilePath}`, {
          cf: { cacheEverything: true },
        });
        if (!response.ok) {
          throw new Error(`${response.status} ${await response.text()}`);
        }
        return response.body!;
      };
      return this.filesystem.createFile(
        `${installDir}/${normalizedFilePath}`,
        await loader(),
        async () => {
          const body = await loader();
          let str = '';
          for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
            str += chunk;
          }
          return str;
        },
      );
    }
    for (const subMeta of meta.files) {
      await this.processMeta(name, version, subMeta, installDir);
    }
  }
}
