import retryableFetch from '../../retryableFetch';
import PackageProvider, { PackageProviderFetchError } from '../PackageProvider';

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

function extractFilesFromMeta(meta: UnpkgMeta, files: string[] = []) {
  if (meta.type === 'file') {
    files.push(meta.path);
    return files;
  }
  for (const subMeta of meta.files) {
    extractFilesFromMeta(subMeta, files);
  }
  return files;
}

const unpkgPackageProvider: PackageProvider = {
  async getPackageFileList(packageName: string, packageVersion: string): Promise<string[]> {
    const response = await retryableFetch(`https://unpkg.com/${packageName}@${packageVersion}/?meta`, {
      cf: { cacheEverything: true },
    });
    if (!response.ok) {
      throw new PackageProviderFetchError({
        packageName,
        packageVersion,
        url: response.url,
        body: await response.text(),
      });
    }
    const meta = await response.json<UnpkgMeta>();
    return extractFilesFromMeta(meta);
  },

  getLoaderForFile(packageName: string, packageVersion: string, fileName: string): () => Promise<string> {
    return async () => {
      const response = await retryableFetch(`https://unpkg.com/${packageName}@${packageVersion}/${fileName}`, {
        cf: { cacheEverything: true },
      });
      if (!response.ok) {
        throw new PackageProviderFetchError({
          packageName,
          packageVersion,
          fileName,
          url: response.url,
          body: await response.text(),
        });
      }
      return response.text();
    };
  },
};

export default unpkgPackageProvider;
