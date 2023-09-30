export type PackageLock = {
  packages?: Record<string, {
    version: string,
    resolved: string,
    dev?: boolean,
  }>
};

type PackageJson = {
  version: string,
  dependencies?: Record<string, string>,
  files?: string[],
};

export default PackageJson;
