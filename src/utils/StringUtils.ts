export class StringUtils {
  public static isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  public static toRegexSource(pattern: RegExp | string): string {
    return this.isString(pattern) ? pattern : pattern.source;
  }

  public static toRegex(pattern: RegExp | string): RegExp {
    return this.isString(pattern) ? new RegExp(pattern) : pattern;
  }

  public static dirname(path: string): string {
    const normalizedPath = this.removeTrailingSlash(path);
    const fileNameIdx = this.fileNameIdx(normalizedPath);
    const dirname = normalizedPath.substring(0, fileNameIdx);

    return this.removeTrailingSlash(dirname);
  }

  public static normalizeName(
    path: string,
    options?: { ext?: string }
  ): string {
    const fileNameIdx = this.fileNameIdx(path);
    const name = this.removeLeadingSlash(path.substring(fileNameIdx));

    const extIdx = name.lastIndexOf('.');

    let ext: string | undefined;
    let nameWithoutExt = name;

    if (extIdx >= 0) {
      ext = options?.ext ?? name.substring(extIdx);
      nameWithoutExt = name.substring(0, extIdx);
    }

    return `${nameWithoutExt}${ext ?? '.har'}`;
  }

  public static escapeCharacters(
    str: string,
    chars: string = '^[]{}()\\\\.$*+?|'
  ): string {
    let foundChar = false;

    const length = chars.length;

    for (let i = 0; i < length; ++i) {
      if (str.indexOf(chars.charAt(i)) !== -1) {
        foundChar = true;
        break;
      }
    }

    if (!foundChar) {
      return str;
    }

    let result = '';

    for (let j = 0; j < str.length; ++j) {
      if (chars.indexOf(str.charAt(j)) !== -1) {
        result += '\\';
      }

      result += str.charAt(j);
    }

    return result;
  }

  private static fileNameIdx(path: string): number {
    return path.indexOf('\\') >= 0
      ? path.lastIndexOf('\\')
      : path.lastIndexOf('/');
  }

  private static removeLeadingSlash(path: string): string {
    return path.replace(/^\/|^\\/, '');
  }

  private static removeTrailingSlash(path: string): string {
    return path.replace(/\/+$|\\+$/, '');
  }
}
