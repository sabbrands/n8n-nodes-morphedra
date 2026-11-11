import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class MorphedraApi implements ICredentialType {
	name = 'morphedraApi';

	displayName = 'Morphedra API';

	documentationUrl = 'https://morphedra.com/api-docs';

	icon: Icon = {
		light: 'file:../nodes/Morphedra/morphedra.svg',
		dark: 'file:../nodes/Morphedra/morphedra.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Create keys at https://morphedra.com/developers. Test keys start with mk_test_, live keys with mk_live_.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.morphedra.com/v1',
			url: '/balance',
			method: 'GET',
		},
	};
}
