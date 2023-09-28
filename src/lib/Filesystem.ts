import { Env } from '../types';

export type FilePath = string;
export type FileLoader = (() => Promise<string> | string);
export type Sha256Hash = string;

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

  readonly hashes = new Map<FilePath, Sha256Hash>();

  protected env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  static async createHash(body: ReadableStream<Uint8Array>, save: boolean) {
    const digestStream = new crypto.DigestStream('SHA-256');
    // await body.pipeTo(digestStream); // todo why doesn't this work?
    const writer = digestStream.getWriter();
    let saved = '';
    for await (const chunk of body) {
      await writer.ready;
      await writer.write(chunk);
      if (save) {
        saved += new TextDecoder().decode(chunk);
      }
    }
    await writer.ready;
    await writer.close();
    const digest = await digestStream.digest;
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return { hash, saved };
  }

  async createFile(path: string, body: ReadableStream<Uint8Array>, loader?: FileLoader) {
    const normalizedPath = path.startsWith('/') ? path.replace('/', '') : path;
    const fileName = normalizedPath.split('/').pop();
    const { hash, saved } = await Filesystem.createHash(
      body,
      fileName === 'package.json' || fileName === 'package-lock.json',
    );

    this.hashes.set(normalizedPath, hash);
    if (saved) {
      this.files.set(normalizedPath, () => saved);
      return;
    }
    this.files.set(
      normalizedPath,
      loader || (async () => {
        const obj = await this.env.FILES.get(hash);
        if (obj) {
          let str = '';
          for await (const chunk of obj.body.pipeThrough(new TextDecoderStream())) {
            str += chunk;
          }
          return str;
        }
        return '';
      }),
    );
  }

  async persistFile(path: string, body: ReadableStream<Uint8Array>, size: number) {
    const hash = this.hashes.get(path);
    if (!hash) {
      throw new Error(`Could not find hash for ${path}`);
    }
    const exists = await this.env.FILES.head(hash);
    if (!exists) {
      await this.env.FILES.put(hash, body.pipeThrough(new FixedLengthStream(size)), {
        sha256: hash,
        httpMetadata: {
          cacheControl: 'public, max-age=31536000, s-maxage=31536000, immutable',
        },
      });
    }
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
