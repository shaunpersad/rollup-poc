import retryableFetch from '../../retryableFetch';
import PackageJson from '../PackageJson';
import PackageProvider, { PackageProviderFetchError } from '../PackageProvider';

const jspmPackageProvider: PackageProvider = {
  async getPackageFileList(packageName: string, packageVersion: string): Promise<string[]> {
    const response = await retryableFetch(`https://ga.jspm.io/npm:${packageName}@${packageVersion}/package.json`, {
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
    const { files = [] } = await response.json<PackageJson>();
    return files;
  },

  getLoaderForFile(packageName: string, packageVersion: string, fileName: string): () => Promise<string> {
    return async () => {
      const response = await retryableFetch(`https://ga.jspm.io/npm:${packageName}@${packageVersion}/${fileName}`, {
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

export default jspmPackageProvider;
