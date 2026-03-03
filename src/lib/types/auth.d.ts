import '@auth/core/jwt';
import '@auth/core/types';

declare module '@auth/core/types' {
	interface User {
		groups?: string[];
	}

	interface Session {
		user?: {
			id: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
			groups: string[];
		};
	}
}

declare module '@auth/core/jwt' {
	interface JWT {
		groups?: string[];
	}
}
