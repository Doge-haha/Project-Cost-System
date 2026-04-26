import {
  createAppRepositories,
  type AppRepositories,
  type CreateAppRepositoryOptions,
} from "./create-app-repositories.js";
import {
  createAppServices,
  type AppServices,
  type CreateAppServiceOptions,
} from "./create-app-services.js";
import {
  InlineTransactionRunner,
  type TransactionRunner,
} from "../shared/tx/transaction.js";

export type CreateAppDependenciesOptions = CreateAppRepositoryOptions &
  CreateAppServiceOptions & {
    appRuntimeMode?: "memory" | "database";
  };

function isInlineTransactionRunner(runner: TransactionRunner): boolean {
  return runner instanceof InlineTransactionRunner;
}

function findInMemoryRepositories(repositories: AppRepositories): string[] {
  return Object.entries(repositories)
    .filter(([, repository]) =>
      repository.constructor.name.startsWith("InMemory"),
    )
    .map(([name]) => name);
}

function validateDatabaseModeDependencies(input: {
  repositories: AppRepositories;
  services: AppServices;
}) {
  if (isInlineTransactionRunner(input.services.transactionRunner)) {
    throw new Error(
      "Database runtime mode requires a non-inline transaction runner",
    );
  }

  const inMemoryRepositories = findInMemoryRepositories(input.repositories);
  if (inMemoryRepositories.length > 0) {
    throw new Error(
      `Database runtime mode requires database-backed repositories for: ${inMemoryRepositories.join(", ")}`,
    );
  }
}

export function createAppDependencies(options: CreateAppDependenciesOptions): {
  repositories: AppRepositories;
  services: AppServices;
} {
  const repositories = createAppRepositories(options);
  const services = createAppServices(repositories, options);

  if (options.appRuntimeMode === "database") {
    validateDatabaseModeDependencies({
      repositories,
      services,
    });
  }

  return {
    repositories,
    services,
  };
}
