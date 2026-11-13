import type { INodeProperties } from 'n8n-workflow';

export const videoOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['video'] } },
		options: [
			{
				name: 'Cancel',
				value: 'cancel',
				description: 'Cancel a video that is still queued and get the full hold back',
				action: 'Cancel a video',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a narrated whiteboard video from 1 to 6 figures',
				action: 'Create a video',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a video by its ID',
				action: 'Get a video',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get your videos, newest first',
				action: 'Get many videos',
			},
		],
		default: 'create',
	},
];

export const videoFields: INodeProperties[] = [
	// ----- Create -----
	
	{
		displayName: 'Specify Figures',
		name: 'figuresInput',
		type: 'options',
		options: [
			{ name: 'Using Fields Below', value: 'fields' },
			{ name: 'Using JSON', value: 'json' },
		],
		default: 'fields',
		displayOptions: { show: { resource: ['video'], operation: ['create'] } },
	},
	{
		displayName: 'Figures',
		name: 'figures',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Figure',
		default: {},
		description:
			'1 to 6 figures, drawn in this order. Give a script for every figure, or for none.',
		displayOptions: {
			show: { resource: ['video'], operation: ['create'], figuresInput: ['fields'] },
		},
		options: [
			{
				displayName: 'Figure',
				name: 'figure',
				values: [
					{
						displayName: 'Image Source',
						name: 'imageSource',
						type: 'options',
						options: [
							{ name: 'Binary Data', value: 'binary' },
							{ name: 'URL', value: 'url' },
						],
						default: 'url',
					},
					{
						displayName: 'Image URL',
						name: 'imageUrl',
						type: 'string',
						default: '',
						placeholder: 'https://example.com/figure1.png',
						description: 'Public https link to a PNG, JPG or WEBP image of at most 5 MB',
						displayOptions: { show: { imageSource: ['url'] } },
					},
					{
						displayName: 'Input Binary Field',
						name: 'binaryPropertyName',
						type: 'string',
						default: 'data',
						description:
							'Name of the binary property that holds the image (PNG, JPG or WEBP, at most 5 MB)',
						displayOptions: { show: { imageSource: ['binary'] } },
					},
					{
						displayName: 'Script',
						name: 'script',
						type: 'string',
						typeOptions: { rows: 3 },
						default: '',
						description:
							'The exact words the voice reads for this figure. Leave empty for all figures to let the narration be composed from the figures and notes.',
					},
				],
			},
		],
	},
	{
		displayName: 'Figures (JSON)',
		name: 'figuresJson',
		type: 'json',
		default:
			'[\n  {\n    "image_url": "https://example.com/figure1.png",\n    "script": "Cells take up the signal and then switch on the repair genes."\n  }\n]',
		description:
			'A list of 1 to 6 figures. Each has image_url or image_base64, and optionally a script.',
		displayOptions: {
			show: { resource: ['video'], operation: ['create'], figuresInput: ['json'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['video'], operation: ['create'] } },
		options: [
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description:
					'Up to 64 characters: letters, digits, - and _. Sending the same request again with the same key returns the first video instead of making a second one.',
			},
			{
				displayName: 'Max Duration (Seconds)',
				name: 'maxDurationSeconds',
				type: 'number',
				typeOptions: { minValue: 10, maxValue: 600 },
				default: 60,
				description:
					'The most you can be charged for this video: this many seconds at 3 cents per second is held from your balance and the real length is charged afterwards. Test keys are limited to 15.',
			},
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description:
					'Background for the narration, up to 5,000 characters. Used only when no scripts are given.',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'Your own label for the video, up to 100 characters',
			},
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'options',
				options: [
					{ name: 'Aoede', value: 'Aoede' },
					{ name: 'Charon', value: 'Charon' },
					{ name: 'Kore', value: 'Kore' },
					{ name: 'Orus', value: 'Orus' },
				],
				default: 'Charon',
			},
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/hooks/morphedra',
				description:
					'Public https address that receives video.completed or video.failed. Optional: you can also use the Morphedra Trigger node or the Wait for Video to Finish option.',
			},
		],
	},
	{
		displayName: 'Wait for Video to Finish',
		name: 'waitForVideo',
		type: 'boolean',
		default: false,
		description:
			'Whether to ask for the video every 10 seconds until it is completed, failed or cancelled. A video usually takes one to six minutes, longer for long videos.',
		displayOptions: { show: { resource: ['video'], operation: ['create'] } },
	},
	{
		displayName: 'Timeout (Minutes)',
		name: 'timeoutMinutes',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 20,
		description:
			'How long to wait before the node stops with an error. The video keeps running in the background.',
		displayOptions: {
			show: { resource: ['video'], operation: ['create'], waitForVideo: [true] },
		},
	},

	// ----- Get / Cancel -----
	{
		displayName: 'Video ID',
		name: 'videoId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'vid_pTcL5JlR5yGALqil',
		displayOptions: { show: { resource: ['video'], operation: ['get', 'cancel'] } },
	},

	// ----- Get Many -----
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['video'], operation: ['getAll'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['video'], operation: ['getAll'], returnAll: [false] } },
	},
];

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get Balance',
				value: 'getBalance',
				description: 'Get your balance and your test video allowance',
				action: 'Get the balance',
			},
			{
				name: 'Get Usage',
				value: 'getUsage',
				description: 'Get totals and counts by status for the last days',
				action: 'Get usage',
			},
		],
		default: 'getBalance',
	},
];

export const accountFields: INodeProperties[] = [
	{
		displayName: 'Days',
		name: 'days',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 90 },
		default: 30,
		description: 'How many days back to count, from 1 to 90',
		displayOptions: { show: { resource: ['account'], operation: ['getUsage'] } },
	},
];
