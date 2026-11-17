export enum CookieAttribute {
  NAME = 'name',
  VALUE = 'value',
  SIZE = 'size',
  DOMAIN = 'domain',
  PORT = 'port',
  PATH = 'path',
  EXPIRES = 'expires',
  HTTPONLY = 'httponly',
  SECURE = 'secure',
  SAMESITE = 'samesite',
  MAXAGE = 'max-age'
}

export class NetworkCookie {
  private readonly _name: string;
  private readonly _value: string;
  private _attributes = new Map<CookieAttribute, string | undefined>();

  private _size: number = 0;

  get size(): number {
    return this._size;
  }

  set size(size: number) {
    this._size = size;
  }

  get name(): string {
    return this._name;
  }

  get value(): string {
    return this._value;
  }

  get httpOnly(): boolean {
    return this._attributes.has(CookieAttribute.HTTPONLY);
  }

  get secure(): boolean {
    return this._attributes.has(CookieAttribute.SECURE);
  }

  get sameSite(): 'Strict' | 'Lax' | 'None' | undefined {
    return this._attributes.get(CookieAttribute.SAMESITE) as any;
  }

  get session(): boolean | undefined {
    return !(
      this._attributes.has(CookieAttribute.EXPIRES) ||
      this._attributes.has(CookieAttribute.MAXAGE)
    );
  }

  get path(): string | undefined {
    return this._attributes.get(CookieAttribute.PATH);
  }

  get port(): string | undefined {
    return this._attributes.get(CookieAttribute.PORT);
  }

  get domain(): string | undefined {
    return this._attributes.get(CookieAttribute.DOMAIN);
  }

  get expires(): string | undefined {
    return this._attributes.get(CookieAttribute.EXPIRES);
  }

  get maxAge(): number | undefined {
    const maxAge: string | undefined = this._attributes.get(
      CookieAttribute.MAXAGE
    );

    return maxAge && !isNaN(+maxAge) ? +maxAge : undefined;
  }

  get url(): string {
    return (this.secure ? 'https://' : 'http://') + this.domain + this.path;
  }

  constructor(name: string, value: string) {
    this._name = name;
    this._value = value;
  }

  public expiresDate(requestDate: Date): Date | undefined {
    if (this.maxAge !== undefined) {
      const targetDate = requestDate === null ? new Date() : requestDate;

      return new Date(targetDate.getTime() + 1000 * this.maxAge);
    }

    if (this.expires) {
      const date = new Date(this.expires);

      return isNaN(date.getTime()) ? undefined : date;
    }

    return undefined;
  }

  public addAttribute(key: string, value?: string): void {
    this._attributes.set(key.toLowerCase() as CookieAttribute, value);
  }
}
