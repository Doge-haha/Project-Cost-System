export interface TransactionRunner {
  runInTransaction<T>(operation: () => Promise<T>): Promise<T>;
}

export class InlineTransactionRunner implements TransactionRunner {
  async runInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}
