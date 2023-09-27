import {
	TAR_OBJECT_TYPE_GNU_NEXT_NAME,
	TAR_OBJECT_TYPE_GNU_NEXT_LINK_NAME,
	TAR_OBJECT_TYPE_PAX_GLOBAL,
	TAR_OBJECT_TYPE_PAX_NEXT,
	TarObject,
	TarObjectCallback
} from './TarObject';
import TarPaxDecoder, { TAR_PAX_KEY_LINK_NAME, TAR_PAX_KEY_NAME } from './TarPaxDecoder';

export default class TarExtender {
	protected forEach: TarObjectCallback;
	protected globalOverrides: Map<string, string> = new Map();
	protected nextOverrides: Map<string, string> = new Map();
	constructor(forEach: TarObjectCallback) {
		this.forEach = forEach;
	}

	async extend(obj: TarObject) {
		if (obj.header.magicBytes === 'ustar') {
			switch (obj.header.type) {
				case TAR_OBJECT_TYPE_PAX_GLOBAL:
					return this.parsePax(obj, true);
				case TAR_OBJECT_TYPE_PAX_NEXT:
					return this.parsePax(obj, false);
				case TAR_OBJECT_TYPE_GNU_NEXT_LINK_NAME:
					return this.parseGnuNextLinkName(obj);
				case TAR_OBJECT_TYPE_GNU_NEXT_NAME:
					return this.parseGnuNextName(obj);
				default:
					this.override(obj);
					break;
			}
		}
		return this.forEach(obj);
	}

	/**
	 * @link https://pubs.opengroup.org/onlinepubs/9699919799/utilities/pax.html#tag_20_92_13_01
	 */
	protected override(obj: TarObject) {
		for (const overrides of [this.globalOverrides, this.nextOverrides]) {
			for (const [key, value] of overrides) {
				switch (key) {
					case 'gid':
						obj.header.groupId = parseInt(value, 10);
						break;
					case 'gname':
						obj.header.groupName = value;
						break;
					case 'mtime':
						obj.header.modifiedTime = Number(value);
						break;
					case 'size':
						obj.header.size = parseInt(value, 10);
						break;
					case 'uid':
						obj.header.userId = parseInt(value, 10);
						break;
					case 'uname':
						obj.header.userName = value;
						break;
					case TAR_PAX_KEY_LINK_NAME:
						obj.header.linkName = value;
						break;
					case TAR_PAX_KEY_NAME:
						obj.header.name = value;
						obj.header.prefix =  '';
						break;
					default:
						obj.header.attrs[key] = value;
						break;
				}
			}
		}
		this.nextOverrides.clear();
		// https://pubs.opengroup.org/onlinepubs/9699919799/utilities/pax.html#tag_20_92_13_06
		if (obj.header.prefix) {
			obj.header.name = `${obj.header.prefix}/${obj.header.name}`;
			obj.header.prefix = '';
		}
	}

	protected async parsePax(obj: TarObject, isGlobal: boolean) {
		if (obj.body) {
			const paxDecoder = new TarPaxDecoder();
			const stream = obj.body
				.pipeThrough(new TextDecoderStream())
				.pipeThrough(paxDecoder.getDecoderStream());
			for await (const { key, value } of stream) {
				(isGlobal ? this.globalOverrides : this.nextOverrides).set(key, value);
			}
		}
	}

	protected async parseGnuNextLinkName(obj: TarObject) {
		if (obj.body) {
			const stream = obj.body.pipeThrough(new TextDecoderStream());
			let linkName = '';
			for await (const str of stream) {
				linkName += str;
			}
			this.nextOverrides.set(TAR_PAX_KEY_LINK_NAME, linkName);
		}
	}

	protected async parseGnuNextName(obj: TarObject) {
		if (obj.body) {
			const stream = obj.body.pipeThrough(new TextDecoderStream());
			let name = '';
			for await (const str of stream) {
				name += str;
			}
			this.nextOverrides.set(TAR_PAX_KEY_NAME, name);
		}
	}
}
