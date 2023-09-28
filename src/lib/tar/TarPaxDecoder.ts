export const TAR_PAX_KEY_NAME = 'path' as const;
export const TAR_PAX_KEY_LINK_NAME = 'linkpath' as const;

enum TarPaxDecoderState {
  DecodingLength,
  DecodingKey,
  DecodingValue,
}

export type TarPaxExtendedHeader = {
  key: string,
  value: string;
};

/**
 * @link https://pubs.opengroup.org/onlinepubs/9699919799/utilities/pax.html#tag_20_92_13_01
 */
export default class TarPaxDecoder {
  protected state = TarPaxDecoderState.DecodingLength;

  protected lengthStr = '';

  protected length = 0;

  protected key = '';

  protected value = '';

  protected numParsed = 0;

  getDecoderStream() {
    return new TransformStream<string, TarPaxExtendedHeader>({
      transform: (chunk, controller) => {
        for (const char of chunk) {
          this.numParsed++;
          switch (this.state) {
            case TarPaxDecoderState.DecodingLength:
              if (this.decodeLength(char)) {
                this.state = TarPaxDecoderState.DecodingKey;
              }
              break;
            case TarPaxDecoderState.DecodingKey:
              if (this.decodeKey(char)) {
                this.state = TarPaxDecoderState.DecodingValue;
              }
              break;
            case TarPaxDecoderState.DecodingValue:
              if (this.decodeValue(char)) {
                controller.enqueue({ key: this.key, value: this.value });
                this.state = TarPaxDecoderState.DecodingLength;
                this.lengthStr = '';
                this.length = 0;
                this.key = '';
                this.value = '';
                this.numParsed = 0;
              }
              break;
            default:
              break;
          }
        }
      },
    });
  }

  protected decodeLength(char: string) {
    if (char === ' ') {
      this.length = parseInt(this.lengthStr, 10);
      if (Number.isNaN(this.length)) {
        throw new Error(`Could not decode pax extended header length from ${this.lengthStr}`);
      }
      return true;
    }
    this.lengthStr += char;

    return false;
  }

  protected decodeKey(char: string) {
    if (char === '=') {
      return true;
    }
    this.key += char;

    return false;
  }

  protected decodeValue(char: string) {
    if (this.numParsed === this.length) {
      return true;
    }
    this.value += char;

    return false;
  }
}
