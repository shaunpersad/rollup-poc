export const TAR_OBJECT_TYPE_FILE = '0' as const;
export const TAR_OBJECT_TYPE_HARD_LINK = '1' as const;
export const TAR_OBJECT_TYPE_SYM_LINK = '2' as const;
export const TAR_OBJECT_TYPE_CHAR_SPECIAL = '3' as const;
export const TAR_OBJECT_TYPE_BLOCK_SPECIAL = '4' as const;
export const TAR_OBJECT_TYPE_DIRECTORY = '5' as const;
export const TAR_OBJECT_TYPE_FIFO = '6' as const;
export const TAR_OBJECT_TYPE_CONTIGUOUS = '7' as const;
export const TAR_OBJECT_TYPE_PAX_GLOBAL = 'g' as const;
export const TAR_OBJECT_TYPE_PAX_NEXT = 'x' as const;
export const TAR_OBJECT_TYPE_GNU_NEXT_LINK_NAME = 'K' as const;
export const TAR_OBJECT_TYPE_GNU_NEXT_NAME = 'L' as const;

export type TarObjectHeader = {
  name: string,
  mode: Uint8Array,
  userId: number,
  groupId: number,
  size: number,
  modifiedTime: number,
  checksum: Uint8Array,
  type: string,
  linkName: string,
  /* UStar */
  magicBytes: string,
  version: Uint8Array,
  userName: string,
  groupName: string,
  deviceMajorNumber: Uint8Array,
  deviceMinorNumber: Uint8Array,
  prefix: string,
  attrs: Record<string, string>,
};

export type TarObject = {
  header: TarObjectHeader,
  body?: ReadableStream<Uint8Array>,
};

export type TarObjectCallback = (obj: TarObject) => Promise<void>;
