export interface TransactionRunner {
  runInTransaction<T>(operation: () => Promise<T>): Promise<T>;
}

export interface TransactionClient {
  query(sql: string): Promise<unknown>;
  release(): void;
}

export interface TransactionPool {
  connect(): Promise<TransactionClient>;
}

export class InlineTransactionRunner implements TransactionRunner {
  async runInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

export class PgTransactionRunner implements TransactionRunner {
  constructor(
    private readonly dependencies: {
      pool: TransactionPool;
    },
  ) {}

  async runInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    const client = await this.dependencies.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await operation();
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export function createTransactionRunner(input?: {
  pool?: TransactionPool | null;
}): TransactionRunner {
  return input?.pool
    ? new PgTransactionRunner({ pool: input.pool })
    : new InlineTransactionRunner();
}
