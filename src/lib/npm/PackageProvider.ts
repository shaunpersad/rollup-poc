export type PackageProviderFetchErrorOptions = {
  packageName: string,
  packageVersion: string,
  fileName?: string,
  url?: string,
  body?: string,
};
export class PackageProviderFetchError extends Error {
  constructor({ packageName, packageVersion, ...optional }: PackageProviderFetchErrorOptions) {
    const message = `[package provider] could not fetch ${packageName}@${packageVersion}`;
    const info: string[] = [];
    for (const [key, value] of Object.entries(optional)) {
      info.push(`${key}: ${value}`);
    }
    super(`${message} ${info.join(', ')}`);
  }
}

export default interface PackageProvider {
  getPackageFileList(packageName: string, packageVersion: string): Promise<string[]>,
  getLoaderForFile(packageName: string, packageVersion: string, fileName: string): () => Promise<string>,
}
