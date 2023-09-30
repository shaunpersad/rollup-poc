import retryableFetch from '../../retryableFetch';
import PackageProvider, { PackageProviderFetchError } from '../PackageProvider';

type SkypackMeta = {
  name: string,
  version: string,
  packageExports: Record<string, {
    id: string,
    optimized: boolean,
    namedExports: string[],
    type: string,
  }>
};

const skypackPackageProvider: PackageProvider = {
  async getPackageFileList(packageName: string, packageVersion: string): Promise<string[]> {
    const response = await retryableFetch(`https://cdn.skypack.dev/${packageName}@${packageVersion}/?meta`, {
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
    const meta = await response.json<SkypackMeta>();
    return Object.values(meta.packageExports).map(({ id }) => {
      if (id.startsWith('.')) {
        return id.replace('.', '');
      }
      return id;
    });
  },

  getLoaderForFile(packageName: string, packageVersion: string, fileName: string): () => Promise<string> {
    return async () => {
      const response = await retryableFetch(`https://cdn.skypack.dev/${packageName}@${packageVersion}/${fileName}?dist=es2020&min`, {
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

export default skypackPackageProvider;
