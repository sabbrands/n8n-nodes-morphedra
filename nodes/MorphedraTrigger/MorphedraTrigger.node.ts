import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { morphedraListVideos, TERMINAL_STATUSES } from '../Morphedra/GenericFunctions';

/** How many video IDs the trigger remembers so it never emits the same video twice. */
const MAX_REMEMBERED_IDS = 200;

export class MorphedraTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Morphedra Trigger',
		name: 'morphedraTrigger',
		icon: { light: 'file:../Morphedra/morphedra.svg', dark: 'file:../Morphedra/morphedra.dark.svg' },
		group: ['trigger'],
		version: [1],
		description: 'Starts the workflow when a Morphedra video is finished. It checks your videos at the poll interval you set and needs no public address or webhook secret.',
		subtitle: '={{$parameter["event"]}}',
		defaults: {
			name: 'Morphedra Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'morphedraApi',
				required: true,
			},
		],
		properties: [
			
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{ name: 'Video Completed', value: 'completed' },
					{ name: 'Video Failed', value: 'failed' },
					{ name: 'Video Completed or Failed', value: 'both' },
				],
				default: 'completed',
				description: 'Which finished videos start the workflow',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as 'completed' | 'failed' | 'both';
		const matches = (video: IDataObject): boolean =>
			event === 'both' ? ['completed', 'failed'].includes(video.status as string) : video.status === event;

		const videos = await morphedraListVideos.call(this, false, 50);

		// "Test step" in the editor: show the newest matching video, change nothing.
		if (this.getMode() === 'manual') {
			const sample = videos.find(matches);
			if (!sample) {
				throw new NodeOperationError(
					this.getNode(),
					'No matching video found to use as example data',
					{ description: 'Create a video first, then run this step again.' },
				);
			}
			return [this.helpers.returnJsonArray([sample])];
		}

		const staticData = this.getWorkflowStaticData('node') as {
			initialized?: boolean;
			seen?: string[];
		};
		const seen = new Set<string>(staticData.seen ?? []);
		const finished = videos.filter((video) => TERMINAL_STATUSES.includes(video.status as string));

		// First run after activation: remember what is already finished, emit nothing.
		if (!staticData.initialized) {
			staticData.initialized = true;
			staticData.seen = finished.map((video) => video.id as string).slice(0, MAX_REMEMBERED_IDS);
			return null;
		}

		const fresh = finished.filter((video) => !seen.has(video.id as string));
		for (const video of fresh) seen.add(video.id as string);
		staticData.seen = [...fresh.map((video) => video.id as string), ...(staticData.seen ?? [])].slice(
			0,
			MAX_REMEMBERED_IDS,
		);

		const toEmit = fresh.filter(matches).reverse(); // oldest first
		if (toEmit.length === 0) return null;
		return [this.helpers.returnJsonArray(toEmit)];
	}
}
