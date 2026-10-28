import { HostPattern } from './HostPattern.ts';
import { describe, it, expect } from '@jest/globals';

describe('HostPattern', () => {
  describe('isHostName', () => {
    it.each([
      'example.com',
      'sub.example.com',
      'localhost',
      'localhost:8080',
      '127.0.0.1',
      '[::1]',
      '[::1]:8080',
      'my_host.local',
      'Example.COM'
    ])('should return true for a host name (pattern: %s)', input => {
      // act
      const result = HostPattern.isHostName(input);
      // assert
      expect(result).toBe(true);
    });

    it.each([
      '\\.example\\.com$',
      '^example.com',
      '.*example.com',
      '(?:example.com)',
      'example.com|other.com',
      'example.com:',
      ''
    ])('should return false for a regular expression (pattern: %s)', input => {
      // act
      const result = HostPattern.isHostName(input);
      // assert
      expect(result).toBe(false);
    });
  });

  describe('toSource', () => {
    it('should return a string as is', () => {
      // act
      const result = HostPattern.toSource('example.com');
      // assert
      expect(result).toBe('example.com');
    });

    it('should wrap the source of a regular expression', () => {
      // act
      const result = HostPattern.toSource(/example.com/);
      // assert
      expect(result).toBe('(?:example.com)');
    });

    it.each([
      { pattern: /example.com/, input: 'https://evil-example.com' },
      { pattern: /^api\./, input: 'https://api.example.com' },
      { pattern: /example\.com$/, input: 'https://sub.example.com' }
    ])(
      'should match the same hosts as the regular expression (pattern: $pattern, url: $input)',
      ({ pattern, input }) => {
        // arrange
        const url = new URL(input);
        // act
        const result = HostPattern.test(HostPattern.toSource(pattern), url);
        // assert
        expect(result).toBe(pattern.test(url.host));
      }
    );
  });

  describe('withBaseUrlHost', () => {
    it.each([undefined, false])(
      'should return the hosts as is when not asked to (includeBaseUrlHost: %s)',
      includeBaseUrlHost => {
        // act
        const result = HostPattern.withBaseUrlHost(
          ['example.com'],
          includeBaseUrlHost,
          'http://localhost:8080'
        );
        // assert
        expect(result).toEqual(['example.com']);
      }
    );

    it('should keep the hosts undefined when not asked to', () => {
      // act
      const result = HostPattern.withBaseUrlHost(
        undefined,
        false,
        'http://localhost:8080'
      );
      // assert
      expect(result).toBeUndefined();
    });

    it.each([
      { baseUrl: 'http://localhost:8080', expected: 'localhost:8080' },
      { baseUrl: 'https://App.Example.com/app/', expected: 'app.example.com' },
      { baseUrl: 'http://[::1]:3000', expected: '[::1]:3000' }
    ])(
      'should add the host of the base URL (baseUrl: $baseUrl)',
      ({ baseUrl, expected }) => {
        // act
        const result = HostPattern.withBaseUrlHost(
          [/example\.com$/],
          true,
          baseUrl
        );
        // assert
        expect(result).toEqual([/example\.com$/, expected]);
      }
    );

    it('should add the host of the base URL when no hosts are given', () => {
      // act
      const result = HostPattern.withBaseUrlHost(
        undefined,
        true,
        'http://localhost:8080'
      );
      // assert
      expect(result).toEqual(['localhost:8080']);
    });

    it('should match only the host of the base URL', () => {
      // arrange
      const pattern = HostPattern.withBaseUrlHost(
        undefined,
        true,
        'http://localhost:8080'
      )?.[0];
      // act
      const result = [
        'http://localhost:8080/api',
        'http://localhost:8081',
        'http://127.0.0.1:8080',
        'http://localhost.attacker.net:8080'
      ].map(x => HostPattern.test(pattern as string, new URL(x)));
      // assert
      expect(result).toEqual([true, false, false, false]);
    });

    it.each([undefined, null, ''])(
      'should throw when the base URL is not set (baseUrl: %j)',
      baseUrl => {
        // act & assert
        expect(() =>
          HostPattern.withBaseUrlHost(undefined, true, baseUrl)
        ).toThrow(TypeError);
      }
    );

    it('should throw when the base URL is invalid', () => {
      // act & assert
      expect(() =>
        HostPattern.withBaseUrlHost(undefined, true, 'localhost')
      ).toThrow(TypeError);
    });

    it.each(['true', 1, null, {}])(
      'should throw when the option is not a boolean (includeBaseUrlHost: %j)',
      includeBaseUrlHost => {
        // act & assert
        expect(() =>
          HostPattern.withBaseUrlHost(
            undefined,
            includeBaseUrlHost as unknown as boolean,
            'http://localhost:8080'
          )
        ).toThrow(TypeError);
      }
    );
  });
});
