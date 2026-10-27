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
});
