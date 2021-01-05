export const serverInfo = {
	issuer: 'https://example.com/auth/realms/test',
	authorization_endpoint: 'https://example.com/auth/realms/test/protocol/openid-connect/auth',
	token_endpoint: 'https://example.com/auth/realms/test/protocol/openid-connect/token',
	token_introspection_endpoint: 'https://example.com/auth/realms/test/protocol/openid-connect/token/introspect',
	userinfo_endpoint: 'https://example.com/auth/realms/test/protocol/openid-connect/userinfo',
	end_session_endpoint: 'https://example.com/auth/realms/test/protocol/openid-connect/logout',
	jwks_uri: 'https://example.com/auth/realms/test/protocol/openid-connect/certs',
	check_session_iframe: 'https://example.com/auth/realms/test/protocol/openid-connect/login-status-iframe.html',
	grant_types_supported: [
		'authorization_code',
		'implicit',
		'refresh_token',
		'password',
		'client_credentials'
	],
	response_types_supported: [
		'code',
		'none',
		'id_token',
		'token',
		'id_token token',
		'code id_token',
		'code token',
		'code id_token token'
	],
	subject_types_supported: [
		'public',
		'pairwise'
	],
	id_token_signing_alg_values_supported: [
		'RS256'
	],
	userinfo_signing_alg_values_supported: [
		'RS256'
	],
	request_object_signing_alg_values_supported: [
		'none',
		'RS256'
	],
	response_modes_supported: [
		'query',
		'fragment',
		'form_post'
	],
	registration_endpoint: 'https://example.com/auth/realms/test/clients-registrations/openid-connect',
	token_endpoint_auth_methods_supported: [
		'private_key_jwt',
		'client_secret_basic',
		'client_secret_post'
	],
	token_endpoint_auth_signing_alg_values_supported: [
		'RS256'
	],
	claims_supported: [
		'sub',
		'iss',
		'auth_time',
		'name',
		'given_name',
		'family_name',
		'preferred_username',
		'email'
	],
	claim_types_supported: [
		'normal'
	],
	claims_parameter_supported: false,
	scopes_supported: [
		'openid',
		'offline_access'
	],
	request_parameter_supported: true,
	request_uri_parameter_supported: true
};
