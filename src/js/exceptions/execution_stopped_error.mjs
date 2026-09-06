// @flow strict
export default class ExecutionStoppedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionStoppedError';
  }
}
