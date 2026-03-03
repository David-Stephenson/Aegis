declare module 'bun:sqlite' {
	type SQLQueryBinding =
		| string
		| number
		| boolean
		| bigint
		| null
		| Uint8Array
		| Record<string, string | number | boolean | bigint | null | Uint8Array>;

	type RunResult = {
		lastInsertRowid: number;
		changes: number;
	};

	class Statement<ReturnType = unknown, ParamsType = unknown> {
		all(...params: ParamsType[]): ReturnType[];
		get(...params: ParamsType[]): ReturnType | null;
		run(...params: ParamsType[]): RunResult;
	}

	class Database {
		constructor(
			filename?: string,
			options?: number | { readonly?: boolean; create?: boolean; readwrite?: boolean; safeIntegers?: boolean; strict?: boolean }
		);
		prepare<ReturnType = unknown, ParamsType = unknown>(sql: string): Statement<ReturnType, ParamsType>;
		query<ReturnType = unknown, ParamsType = unknown>(sql: string): Statement<ReturnType, ParamsType>;
		run(sql: string, params?: SQLQueryBinding): RunResult;
		exec(sql: string, params?: SQLQueryBinding): RunResult;
	}
}
