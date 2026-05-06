import client from "../../Config/database.ts";

type RowData = Record<string, unknown>;

type SearchOptions = {
    keywords?: string;
    columns?: string[];
    sortBy?: string;
    descending?: boolean;
};

function quoteIdentifier(identifier: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error(`Invalid SQL identifier: ${identifier}`);
    }
    return `"${identifier}"`;
}

export abstract class GenericRepository<
    TEntity extends { id?: number },
    TCreate extends Record<string, unknown>,
    TUpdate extends Record<string, unknown>,
> {
    private readonly tableName: string;
    private readonly tableSql: string;
    private readonly primaryKeySql: string;

    constructor(tableName: string, primaryKey = "id") {
        this.tableName = tableName;
        this.tableSql = quoteIdentifier(tableName);
        this.primaryKeySql = quoteIdentifier(primaryKey);
    }

    protected abstract mapRow(row: RowData): TEntity;
    protected abstract mapCreateInput(data: TCreate): Record<string, unknown>;
    protected abstract mapUpdateInput(data: TUpdate): Record<string, unknown>;
    protected abstract searchableColumns(): string[];

    private async queryRows(query: string, args: unknown[] = []): Promise<RowData[]> {
        const result = await client.queryObject<RowData>({ text: query, args });
        return result.rows;
    }

    private async querySingleNumber(query: string, args: unknown[] = []): Promise<number> {
        const result = await client.queryObject<{ total: number }>({ text: query, args });
        const row = result.rows[0];
        return row?.total ?? 0;
    }

    private toAssignments(payload: Record<string, unknown>, offset = 1): { sql: string; args: unknown[] } {
        const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
        if (entries.length === 0) {
            throw new Error("Cannot build SQL query with an empty payload.");
        }

        const sql = entries
            .map(([column], index) => `${quoteIdentifier(column)} = $${index + offset}`)
            .join(", ");

        return {
            sql,
            args: entries.map(([, value]) => value),
        };
    }

    public async findAll(): Promise<TEntity[]> {
        const query = `SELECT * FROM ${this.tableSql}`;
        const rows = await this.queryRows(query);
        return rows.map((row) => this.mapRow(row));
    }

    public async getAll(): Promise<TEntity[]> {
        return this.findAll();
    }

    public async count(): Promise<number> {
        const query = `SELECT COUNT(*)::int AS total FROM ${this.tableSql}`;
        return this.querySingleNumber(query);
    }

    public async findById(id: number): Promise<TEntity | null> {
        const query = `SELECT * FROM ${this.tableSql} WHERE ${this.primaryKeySql} = $1 LIMIT 1`;
        const rows = await this.queryRows(query, [id]);
        return rows.length > 0 ? this.mapRow(rows[0]) : null;
    }

    protected async findOneBy(column: string, value: unknown): Promise<TEntity | null> {
        const columnSql = quoteIdentifier(column);
        const query = `SELECT * FROM ${this.tableSql} WHERE ${columnSql} = $1 LIMIT 1`;
        const rows = await this.queryRows(query, [value]);
        return rows.length > 0 ? this.mapRow(rows[0]) : null;
    }

    protected async findManyBy(column: string, value: unknown): Promise<TEntity[]> {
        const columnSql = quoteIdentifier(column);
        const query = `SELECT * FROM ${this.tableSql} WHERE ${columnSql} = $1`;
        const rows = await this.queryRows(query, [value]);
        return rows.map((row) => this.mapRow(row));
    }

    public async create(data: TCreate): Promise<TEntity> {
        const payload = this.mapCreateInput(data);
        const entries = Object.entries(payload).filter(([, value]) => value !== undefined);

        if (entries.length === 0) {
            throw new Error("Cannot insert an empty payload.");
        }

        const columns = entries.map(([column]) => quoteIdentifier(column)).join(", ");
        const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
        const args = entries.map(([, value]) => value);

        const query = `INSERT INTO ${this.tableSql} (${columns}) VALUES (${placeholders}) RETURNING *`;
        const rows = await this.queryRows(query, args);

        if (rows.length === 0) {
            throw new Error("Insert did not return any row.");
        }

        return this.mapRow(rows[0]);
    }

    public async save(data: TCreate): Promise<TEntity> {
        return this.create(data);
    }

    public async updateById(id: number, data: TUpdate): Promise<TEntity | null> {
        const payload = this.mapUpdateInput(data);
        const assignments = this.toAssignments(payload);
        const query = `UPDATE ${this.tableSql} SET ${assignments.sql} WHERE ${this.primaryKeySql} = $${assignments.args.length + 1} RETURNING *`;
        const rows = await this.queryRows(query, [...assignments.args, id]);

        return rows.length > 0 ? this.mapRow(rows[0]) : null;
    }

    public async update(id: number, data: TUpdate): Promise<TEntity | null> {
        return this.updateById(id, data);
    }

    public async deleteById(id: number): Promise<boolean> {
        const query = `DELETE FROM ${this.tableSql} WHERE ${this.primaryKeySql} = $1`;
        const result = await client.queryObject({ text: query, args: [id] });
        return result.rowCount > 0;
    }

    public async search(options: SearchOptions = {}): Promise<TEntity[]> {
        const args: unknown[] = [];
        const sqlParts = [`SELECT * FROM ${this.tableSql}`];

        if (options.keywords && options.keywords.trim().length > 0) {
            const fallbackColumns = this.searchableColumns();
            const requestedColumns = options.columns && options.columns.length > 0
                ? options.columns
                : fallbackColumns;
            if (requestedColumns.length === 0) {
                throw new Error("No searchable columns were provided.");
            }

            const safeColumns = requestedColumns.map((column) => quoteIdentifier(column));
            const keywordArg = `%${options.keywords.trim()}%`;

            const whereParts = safeColumns.map((column, index) => {
                args.push(keywordArg);
                return `${column}::text ILIKE $${index + 1}`;
            });

            sqlParts.push(`WHERE (${whereParts.join(" OR ")})`);
        }

        if (options.sortBy) {
            const sortColumn = quoteIdentifier(options.sortBy);
            const direction = options.descending ? "DESC" : "ASC";
            sqlParts.push(`ORDER BY ${sortColumn} ${direction}`);
        }

        const rows = await this.queryRows(sqlParts.join(" "), args);
        return rows.map((row) => this.mapRow(row));
    }
}



