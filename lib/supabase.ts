import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabase-config';

const supabaseConfig = getSupabaseConfig();

const supabaseDisabledError = new Error(
	"Supabase is disabled because NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are missing.",
);

function createDisabledAuthClient() {
	const authFallback = {
		async getUser() {
			return { data: { user: null }, error: supabaseDisabledError };
		},
		async getSession() {
			return { data: { session: null }, error: supabaseDisabledError };
		},
		async signOut() {
			return { error: supabaseDisabledError };
		},
		async updateUser() {
			return { data: { user: null }, error: supabaseDisabledError };
		},
		async signInWithPassword() {
			return { data: { user: null, session: null }, error: supabaseDisabledError };
		},
		async signUp() {
			return { data: { user: null, session: null }, error: supabaseDisabledError };
		},
		async resetPasswordForEmail() {
			return { data: null, error: supabaseDisabledError };
		},
		async exchangeCodeForSession() {
			return { data: { session: null }, error: supabaseDisabledError };
		},
		async setSession() {
			return { data: { session: null }, error: supabaseDisabledError };
		},
		onAuthStateChange() {
			return {
				data: {
					subscription: {
						unsubscribe() {},
					},
				},
			};
		},
	};

	return new Proxy(authFallback, {
		get(target, prop) {
			if (prop in target) {
				return Reflect.get(target, prop);
			}

			return async () => ({ data: null, error: supabaseDisabledError });
		},
	});
}

function createDisabledChannel() {
	const channel: Record<string, unknown> = {
		on() {
			return channelProxy;
		},
		subscribe() {
			return channelProxy;
		},
		track() {
			return Promise.resolve({ error: null });
		},
		presenceState() {
			return {};
		},
	};

	const channelProxy = new Proxy(channel, {
		get(target, prop) {
			if (prop in target) {
				return Reflect.get(target, prop);
			}

			return () => channelProxy;
		},
	});

	return channelProxy;
}

function createDisabledQueryBuilder() {
	const builder: Record<string | symbol, unknown> = {
		then(onFulfilled: (value: unknown) => unknown) {
			return Promise.resolve(
				onFulfilled({ data: null, error: supabaseDisabledError }),
			);
		},
		catch() {
			return builderProxy;
		},
		finally() {
			return builderProxy;
		},
	};

	const builderProxy = new Proxy(builder, {
		get(target, prop) {
			if (prop in target) {
				return Reflect.get(target, prop);
			}

			return () => builderProxy;
		},
	});

	return builderProxy;
}

function createDisabledSupabaseClient(): SupabaseClient {
	const auth = createDisabledAuthClient();
	const queryBuilder = createDisabledQueryBuilder();
	const channel = createDisabledChannel();

	return new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === "auth") return auth;
				if (prop === "from") return () => queryBuilder;
				if (prop === "channel") return () => channel;
				if (prop === "removeChannel") return () => channel;

				return queryBuilder;
			},
		},
	)as unknown as SupabaseClient;
}

const supabase: SupabaseClient = supabaseConfig
	? createBrowserClient(
			supabaseConfig.supabaseUrl,
			supabaseConfig.supabaseAnonKey
	  )
	: createDisabledSupabaseClient();

export { supabase };

export type SupabaseLikeClient = SupabaseClient;
