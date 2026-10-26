import { ErrorUtils } from './ErrorUtils.ts';
import { describe, it, expect } from '@jest/globals';

describe('ErrorUtils', () => {
  describe('isError', () => {
    it('should return true for an instance of error', () => {
      // arrange
      const error = new Error('Test error');
      // act
      const result = ErrorUtils.isError(error);
      // assert
      expect(result).toBe(true);
    });

    it('should return false for a non-error object', () => {
      // arrange
      const notAnError = { message: 'Test error' };
      // act
      const result = ErrorUtils.isError(notAnError);
      // assert
      expect(result).toBe(false);
    });

    it('should return false for a primitive type', () => {
      // arrange
      const primitive = 'string';
      // act
      const result = ErrorUtils.isError(primitive);
      // assert
      expect(result).toBe(false);
    });
  });
});
