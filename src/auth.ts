import { SvelteKitAuth } from '@auth/sveltekit';
import type { OAuthConfig } from '@auth/core/providers';
import { appEnv } from '$lib/server/env';

type AuthentikProfile = {
	sub: string;
	name?: string;
	email?: string;
	groups?: string[];
};

const authentikProvider: OAuthConfig<AuthentikProfile> = {
	id: 'authentik',
	name: 'Authentik',
	type: 'oidc',
	issuer: appEnv.AUTH_AUTHENTIK_ISSUER,
	clientId: appEnv.AUTH_AUTHENTIK_CLIENT_ID,
	clientSecret: appEnv.AUTH_AUTHENTIK_CLIENT_SECRET,
	checks: ['pkce', 'state'],
	authorization: {
		params: {
			scope: 'openid profile email groups'
		}
	},
	profile(profile) {
		return {
			id: profile.sub,
			name: profile.name ?? null,
			email: profile.email ?? null,
			groups: profile.groups ?? []
		};
	}
};

export const { handle, signIn, signOut } = SvelteKitAuth({
	secret: appEnv.AUTH_SECRET,
	providers: [authentikProvider],
	trustHost: true,
	callbacks: {
		jwt({ token, user }) {
			const groups = (user && 'groups' in user && Array.isArray(user.groups) ? user.groups : token.groups) ?? [];
			token.groups = groups;
			return token;
		},
		session({ session, token }) {
			if (session.user) {
				session.user.id = token.sub ?? '';
				session.user.groups = Array.isArray(token.groups) ? token.groups.map((group) => String(group)) : [];
			}
			return session;
		}
	}
});
