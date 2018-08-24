/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import E from './errors';

import Authenticator from './authenticators/authenticator';
import ClientSecret from './authenticators/client-secret';
import OwnerPassword from './authenticators/owner-password';
import PKCE from './authenticators/pkce';
import SignedJWT from './authenticators/signed-jwt';

import FileStore from './stores/file-store';
import MemoryStore from './stores/memory-store';
import SecureStore from './stores/secure-store';
import TokenStore from './stores/token-store';

import environments from './environments';
import fetch from 'node-fetch';
import getEndpoints from './endpoints';
import snooplogg from 'snooplogg';
import * as server from './server';

import { getServerInfo } from './util';

const { log } = snooplogg('amplify-auth');
const { alert, highlight, magenta, note } = snooplogg.styles;

/**
 * Authenticates the machine and retreives the auth token.
 */
export default class Auth {
	/**
	 * The store to persist the token.
	 *
	 * @type {TokenStore}
	 * @access private
	 */
	tokenStore = null;

	/**
	 * Initializes the authentication instance by setting the default settings and creating the
	 * token store.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} [opts.clientId] - The client id to specify when authenticating.
	 * @param {String} [opts.clientSecret] - The secret token to use to authenticate.
	 * @param {String} [opts.env=prod] - The environment name. Must be `dev`, `preprod`, or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {String} [opts.secureServiceName="Axway AMPLIFY Auth"] - The name of the consumer
	 * using this library when using the "secure" token store.
	 * @param {String} [opts.password] - The password used to authenticate. Requires a `username`.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {String} [opts.secretFile] - The path to the jwt secret file.
	 * @param {Boolean} [opts.serviceAccount=false] - When `true`, indicates authentication is being
	 * requested by a service instead of a user.
	 * @param {Boolean} [opts.tokenRefreshThreshold=0] - The number of seconds before the access
	 * token expires and should be refreshed.
	 * @param {TokenStore} [opts.tokenStore] - A token store instance for persisting the tokens.
	 * @param {String} [opts.tokenStoreDir] - The directory where the token store is saved. Required
	 * when the `tokenStoreType` is `secure` or `file`.
	 * @param {String} [opts.tokenStoreType=auto] - The type of store to persist the access token.
	 * Possible values include: `auto`, `secure`, `file`, or `memory`. If value is `auto`, it will
	 * attempt to use `secure`, then `file`, then `memory`. If set to `null`, then it will not
	 * persist the access token.
	 * @param {String} [opts.username] - The username used to authenticate. Requires a `password`.
	 * @access public
	 */
	constructor(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		Object.defineProperties(this, {
			baseUrl:        { value: opts.baseUrl },
			clientId:       { value: opts.clientId },
			clientSecret:   { value: opts.clientSecret },
			env:            { value: opts.env },
			messages:       { value: opts.messages },
			password:       { value: opts.password },
			realm:          { value: opts.realm },
			secretFile:     { value: opts.secretFile },
			serviceAccount: { value: opts.serviceAccount },
			username:       { value: opts.username }
		});

		if (opts.tokenStore) {
			if (!(opts.tokenStore instanceof TokenStore)) {
				throw E.INVALID_PARAMETER('Expected the token store to be a "TokenStore" instance');
			}
			this.tokenStore = opts.tokenStore;
		} else {
			const tokenStoreType = opts.tokenStoreType === undefined ? 'auto' : opts.tokenStoreType;
			switch (tokenStoreType) {
				case 'auto':
				case 'secure':
					try {
						this.tokenStore = new SecureStore(opts);
						break;
					} catch (e) {
						/* istanbul ignore if */
						if (tokenStoreType === 'auto') {
							// let 'auto' fall through
						} else {
							throw e;
						}
					}

				case 'file':
					try {
						this.tokenStore = new FileStore(opts);
						break;
					} catch (e) {
						/* istanbul ignore if */
						if (tokenStoreType === 'auto' && e.code === 'ERR_MISSING_REQUIRED_PARAMETER') {
							// let 'auto' fall through
						} else {
							throw e;
						}
					}

				case 'memory':
					this.tokenStore = new MemoryStore(opts);
					break;
			}
		}
	}

	/**
	 * Ensures the options contains the configurable settings. Validation is handled by the code
	 * requiring the values.
	 *
	 * @param {Object} [opts] - Various options.
	 * @access private
	 */
	applyDefaults(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		const env = opts.env || this.env || 'prod';
		if (!environments[env]) {
			throw E.INVALID_VALUE(`Invalid environment: ${opts.env || this.env}`);
		}

		opts.baseUrl        = opts.baseUrl || this.baseUrl || environments[env].baseUrl;
		opts.clientId       = opts.clientId || this.clientId;
		opts.clientSecret   = opts.clientSecret || this.clientSecret;
		opts.env            = env;
		opts.messages       = opts.messages || this.messages;
		opts.password       = opts.password || this.password;
		opts.realm          = opts.realm || this.realm;
		opts.secretFile     = opts.secretFile || this.secretFile;
		opts.serviceAccount = opts.serviceAccount || this.serviceAccount;
		opts.tokenStore     = this.tokenStore;
		opts.username       = opts.username || this.username;
	}

	/**
	 * Creates an authetnicator based on the supplied options.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Authenticator} [opts.authenticator] - An authenticator instance to use. If not
	 * specified, one will be auto-selected based on the options.
	 * @param {String} [opts.clientSecret] - The secret token to use to authenticate.
	 * @param {String} [opts.password] - The password used to authenticate. Requires a `username`.
	 * @param {String} [opts.secretFile] - The path to the jwt secret file.
	 * @param {Boolean} [opts.serviceAccount=false] - When `true`, indicates authentication is being
	 * requested by a service instead of a user.
	 * @param {String} [opts.username] - The username used to authenticate. Requires a `password`.
	 * @returns {Authenticator}
	 * @access public
	 */
	createAuthenticator(opts = {}) {
		if (opts.authenticator) {
			if (!(opts.authenticator instanceof Authenticator)) {
				throw E.INVALID_ARUGMENT('Expected authenticator to be an Authenticator instance.');
			}
			return opts.authenticator;
		}

		if (typeof opts.username === 'string' && opts.username && typeof opts.password === 'string') {
			return new OwnerPassword(opts);
		}

		if (typeof opts.clientSecret === 'string' && opts.clientSecret) {
			return new ClientSecret(opts);
		}

		if (typeof opts.secretFile === 'string' && opts.secretFile) {
			return new SignedJWT(opts);
		}

		return new PKCE(opts);
	}

	/**
	 * Retrieves the access token. If the authenticator is interactive and the authenticator has not
	 * yet authenticated with the server, an error is thrown.
	 *
	 * @param {Object} opts - Required options.
	 * @param {String} opts.accountName - The account name to retrieve.
	 * @param {Authenticator} [opts.authenticator] - An authenticator instance to use. If not
	 * specified, one will be auto-selected based on the options.
	 * @param {String} [opts.baseUrl] - The base URL to filter by.
	 * @returns {Promise<?Object>}
	 * @access public
	 */
	async getAccount(opts = {}) {
		if (!this.tokenStore) {
			log('Cannot get account, no token store');
			return null;
		}

		this.applyDefaults(opts);

		const authenticator = this.createAuthenticator(opts);
		opts.hash = authenticator.hash;
		return await this.tokenStore.get(opts);
	}

	/**
	 * Returns a list of all valid access tokens.
	 *
	 * @returns {Promise<Array>}
	 * @access public
	 */
	async list() {
		if (this.tokenStore) {
			return await this.tokenStore.list();
		}
		return [];
	}

	/**
	 * Authenticates using the configured authenticator.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String|Array.<String>} [opt.app] - Specify the app to open the `target` with, or an
	 * array with the app and app arguments.
	 * @param {Authenticator} [opts.authenticator] - An authenticator instance to use. If not
	 * specified, one will be auto-selected based on the options.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} [opts.clientId] - The client id to specify when authenticating.
	 * @param {String} [opts.code] - The authentication code from a successful interactive login.
	 * @param {String} [opts.env=prod] - The environment name. Must be `dev`, `preprod`, or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {Boolean} [opts.manual=false] - When `true`, it will return the auth URL instead of
	 * launching the auth URL in the default browser.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {Number} [opts.timeout] - The number of milliseconds to wait before timing out.
	 * Defaults to the `interactiveLoginTimeout` property.
	 * @param {Boolean} [opts.wait=false] - Wait for the opened app to exit before fulfilling the
	 * promise. If `false` it's fulfilled immediately when opening the app.
	 * @returns {Promise<Object>} Resolves an object containing the access token, account name, and
	 * user info.
	 * @access public
	 */
	async login(opts = {}) {
		this.applyDefaults(opts);
		const authenticator = this.createAuthenticator(opts);
		return await authenticator.login(opts);
	}

	/**
	 * Revokes all or specific authenticated accounts.
	 *
	 * @param {Object} opts - Required options.
	 * @param {Array.<String>|String} opts.accounts - A list of accounts names.
	 * @param {Boolean} opts.all - When `true`, revokes all accounts.
	 * @param {String} [opts.baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>} Returns a list of revoked credentials.
	 * @access public
	 */
	async revoke({ accounts, all, baseUrl } = {}) {
		if (!this.tokenStore) {
			log('No token store, returning empty array');
			return [];
		}

		if (!all && typeof accounts !== 'string' && !Array.isArray(accounts)) {
			throw E.INVALID_ARGUMENT('Expected accounts to be "all" or a list of accounts');
		}

		if (!all && !accounts.length) {
			return [];
		}

		let revoked;
		if (all) {
			revoked = await this.tokenStore.clear(baseUrl);
		} else {
			revoked = await this.tokenStore.delete(accounts, baseUrl);
		}

		if (Array.isArray(revoked)) {
			for (const entry of revoked) {
				const url = `${getEndpoints(entry).logout}?id_token_hint=${entry.tokens.id_token}`;
				const res = await fetch(url);
				if (res.ok) {
					log(`Successfully logged out ${highlight(entry.name)} ${magenta(res.status)} ${note(`(${entry.baseUrl}, ${entry.realm})`)}`);
				} else {
					log(`Failed to log out ${highlight(entry.name)} ${alert(res.status)} ${note(`(${entry.baseUrl}, ${entry.realm})`)}`);
				}
			}
		}

		return revoked;
	}

	/**
	 * Discovers available endpoints based on the authentication server's OpenID configuration.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} [opts.env=prod] - The environment name. Must be `dev`, `preprod`, or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {String} [opts.url] - An optional URL to discover the available endpoints.
	 * @returns {Promise<Object>}
	 * @access public
	 */
	async serverInfo(opts = {}) {
		this.applyDefaults(opts);

		let { url } = opts;

		if (!url) {
			url = getEndpoints(opts).wellKnown;
		}

		return await getServerInfo(url);
	}
}

export {
	Auth,

	Authenticator,
	ClientSecret,
	OwnerPassword,
	PKCE,
	SignedJWT,

	FileStore,
	MemoryStore,
	SecureStore,
	TokenStore,

	environments,
	getEndpoints,
	server
};