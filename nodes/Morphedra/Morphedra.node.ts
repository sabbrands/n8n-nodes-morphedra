import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	morphedraApiRequest,
	morphedraListVideos,
	morphedraWaitForVideo,
} from './GenericFunctions';
import { accountFields, accountOperations, videoFields, videoOperations } from './descriptions';

interface FigureInput {
	imageSource?: 'url' | 'binary';
	imageUrl?: string;
	binaryPropertyName?: string;
	script?: string;
}

export class Morphedra implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Morphedra',
		name: 'morphedra',
		icon: { light: 'file:morphedra.svg', dark: 'file:morphedra.dark.svg' },
		group: ['output'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Turn scientific figures into narrated whiteboard videos with the Morphedra Whiteboard Video API',
		defaults: {
			name: 'Morphedra',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'morphedraApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Video', value: 'video' },
				],
				default: 'video',
			},
			...videoOperations,
			...videoFields,
			...accountOperations,
			...accountFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'video') {
					if (operation === 'create') {
						const body: IDataObject = {};
						const figuresInput = this.getNodeParameter('figuresInput', i, 'fields') as string;
						body.figures =
							figuresInput === 'json'
								? readFiguresJson.call(this, i)
								: await buildFigures.call(this, i);

						const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
						if (additional.title) body.title = additional.title;
						if (additional.notes) body.notes = additional.notes;
						if (additional.voice) body.voice = additional.voice;
						if (additional.maxDurationSeconds !== undefined && additional.maxDurationSeconds !== '') {
							body.max_duration_seconds = additional.maxDurationSeconds;
						}
						if (additional.webhookUrl) body.webhook_url = additional.webhookUrl;

						const headers: IDataObject = {};
						if (additional.idempotencyKey) headers['Idempotency-Key'] = additional.idempotencyKey;

						let video = await morphedraApiRequest.call(this, 'POST', '/videos', {
							body,
							headers,
							itemIndex: i,
						});

						if (this.getNodeParameter('waitForVideo', i, false) as boolean) {
							const timeoutMinutes = this.getNodeParameter('timeoutMinutes', i, 20) as number;
							const result = await morphedraWaitForVideo.call(
								this,
								video.id as string,
								timeoutMinutes,
								i,
							);
							video = result.video;
							if (result.timedOut) {
								throw new NodeOperationError(
									this.getNode(),
									`Video ${String(video.id)} was still "${String(video.status)}" after ${timeoutMinutes} minutes`,
									{
										itemIndex: i,
										description:
											'The video keeps running in the background and is charged only for its real length. Use "Get" with this video ID later, or use the Morphedra Trigger node.',
									},
								);
							}
						}
						returnData.push({ json: video, pairedItem: { item: i } });
					} else if (operation === 'get') {
						const videoId = this.getNodeParameter('videoId', i) as string;
						const video = await morphedraApiRequest.call(
							this,
							'GET',
							`/videos/${encodeURIComponent(videoId)}`,
							{ itemIndex: i },
						);
						returnData.push({ json: video, pairedItem: { item: i } });
					} else if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const limit = returnAll ? 0 : (this.getNodeParameter('limit', i) as number);
						const videos = await morphedraListVideos.call(this, returnAll, limit, i);
						for (const video of videos) {
							returnData.push({ json: video, pairedItem: { item: i } });
						}
					} else if (operation === 'cancel') {
						const videoId = this.getNodeParameter('videoId', i) as string;
						const video = await morphedraApiRequest.call(
							this,
							'POST',
							`/videos/${encodeURIComponent(videoId)}/cancel`,
							{ itemIndex: i },
						);
						returnData.push({ json: video, pairedItem: { item: i } });
					}
				} else if (resource === 'account') {
					if (operation === 'getBalance') {
						const balance = await morphedraApiRequest.call(this, 'GET', '/balance', {
							itemIndex: i,
						});
						returnData.push({ json: balance, pairedItem: { item: i } });
					} else if (operation === 'getUsage') {
						const days = this.getNodeParameter('days', i, 30) as number;
						const usage = await morphedraApiRequest.call(this, 'GET', '/usage', {
							qs: { days },
							itemIndex: i,
						});
						returnData.push({ json: usage, pairedItem: { item: i } });
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

async function buildFigures(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const figuresParam = this.getNodeParameter('figures', itemIndex, {}) as {
		figure?: FigureInput[];
	};
	const figureInputs = figuresParam.figure ?? [];
	if (figureInputs.length === 0) {
		throw new NodeOperationError(this.getNode(), 'Add at least one figure', {
			itemIndex,
			description: 'A video needs 1 to 6 figures.',
		});
	}

	const figures: IDataObject[] = [];
	for (const input of figureInputs) {
		const figure: IDataObject = {};
		if (input.imageSource === 'binary') {
			const propertyName = input.binaryPropertyName || 'data';
			this.helpers.assertBinaryData(itemIndex, propertyName);
			const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, propertyName);
			figure.image_base64 = buffer.toString('base64');
		} else {
			if (!input.imageUrl) {
				throw new NodeOperationError(this.getNode(), 'A figure has no image URL', {
					itemIndex,
					description: 'Enter a public https link to a PNG, JPG or WEBP image.',
				});
			}
			figure.image_url = input.imageUrl;
		}
		if (input.script) figure.script = input.script;
		figures.push(figure);
	}
	return figures;
}

function readFiguresJson(this: IExecuteFunctions, itemIndex: number): IDataObject[] {
	const raw = this.getNodeParameter('figuresJson', itemIndex, '[]') as string | IDataObject[];
	let parsed: unknown = raw;
	if (typeof raw === 'string') {
		try {
			parsed = JSON.parse(raw);
		} catch {
			throw new NodeOperationError(this.getNode(), 'Figures (JSON) is not valid JSON', {
				itemIndex,
			});
		}
	}
	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new NodeOperationError(this.getNode(), 'Figures (JSON) must be a list with 1 to 6 figures', {
			itemIndex,
		});
	}
	return parsed as IDataObject[];
}
