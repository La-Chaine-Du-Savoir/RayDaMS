export interface MigrationExecutor {
    queryArray<T = unknown[]>(query: string | TemplateStringsArray, ...args: unknown[]): Promise<{ rows: T[] }>;
    queryObject<T extends Record<string, unknown> = Record<string, unknown>>(
        query: string | TemplateStringsArray,
        ...args: unknown[]
    ): Promise<{ rows: T[] }>;
}

export interface MigrationModule {
    version?: number;
    name?: string;
    up(executor: MigrationExecutor): Promise<void> | void;
}

