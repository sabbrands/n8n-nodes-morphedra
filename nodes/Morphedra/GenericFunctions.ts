import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, sleep } from 'n8n-workflow';

export const API_BASE_URL = 'https://api.morphedra.com/v1';

/** How often "Wait for Video to Finish" asks for the video. The API limit is 30 requests per minute per key. */
export const pollSettings = { intervalMs: 10_000 };

export const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

type MorphedraContext = IExecuteFunctions | IPollFunctions;

function pickErrorBody(error: unknown): IDataObject | undefined {
	const e = error as IDataObject & {
		response?: IDataObject;
		cause?: IDataObject & { response?: IDataObject };
		context?: IDataObject;
	};
	const candidates: unknown[] = [
		e?.response?.body,
		e?.response?.data,
		e?.cause?.response?.data,
		e?.cause?.response?.body,
		e?.context?.data,
	];
	for (const candidate of candidates) {
		let body = candidate;
		if (typeof body === 'string') {
			try {
				body = JSON.parse(body);
			} catch {
				continue;
			}
		}
		if (body && typeof body === 'object' && (body as IDataObject).error) {
			const inner = (body as IDataObject).error;
			if (inner && typeof inner === 'object') return inner as IDataObject;
		}
	}
	return undefined;
}

export async function morphedraApiRequest(
	this: MorphedraContext,
	method: IHttpRequestMethods,
	path: string,
	options: { body?: IDataObject; qs?: IDataObject; headers?: IDataObject; itemIndex?: number } = {},
): Promise<IDataObject> {
	const requestOptions: IHttpRequestOptions = {
		method,
		url: `${API_BASE_URL}${path}`,
		json: true,
	};
	if (options.body) requestOptions.body = options.body;
	if (options.qs && Object.keys(options.qs).length > 0) requestOptions.qs = options.qs;
	if (options.headers && Object.keys(options.headers).length > 0) {
		requestOptions.headers = options.headers as Record<string, string>;
	}

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'morphedraApi',
			requestOptions,
		)) as IDataObject;
	} catch (error) {
		const apiError = pickErrorBody(error);
		if (apiError && typeof apiError.message === 'string') {
			const code = typeof apiError.code === 'string' ? apiError.code : 'error';
			const requestId =
				typeof apiError.request_id === 'string' ? ` Request ID: ${apiError.request_id}.` : '';
			throw new NodeApiError(this.getNode(), error as JsonObject, {
				message: `${code}: ${apiError.message}`,
				description: `The Morphedra API refused the request.${requestId}`,
				itemIndex: options.itemIndex,
			});
		}
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			itemIndex: options.itemIndex,
		});
	}
}

export async function morphedraListVideos(
	this: MorphedraContext,
	returnAll: boolean,
	limit: number,
	itemIndex?: number,
): Promise<IDataObject[]> {
	const videos: IDataObject[] = [];
	let startingAfter: string | undefined;
	for (;;) {
		const pageSize = returnAll ? 50 : Math.min(50, limit - videos.length);
		const qs: IDataObject = { limit: pageSize };
		if (startingAfter) qs.starting_after = startingAfter;
		const page = await morphedraApiRequest.call(this, 'GET', '/videos', { qs, itemIndex });
		const data = (page.data as IDataObject[] | undefined) ?? [];
		videos.push(...data);
		if (!page.has_more || data.length === 0) break;
		if (!returnAll && videos.length >= limit) break;
		startingAfter = data[data.length - 1].id as string;
	}
	return returnAll ? videos : videos.slice(0, limit);
}

/** Asks for the video until it is completed, failed or cancelled, or until the timeout passes. */
export async function morphedraWaitForVideo(
	this: IExecuteFunctions,
	videoId: string,
	timeoutMinutes: number,
	itemIndex: number,
): Promise<{ video: IDataObject; timedOut: boolean }> {
	const deadline = Date.now() + timeoutMinutes * 60_000;
	let video: IDataObject = { id: videoId };
	for (;;) {
		await sleep(pollSettings.intervalMs);
		video = await morphedraApiRequest.call(this, 'GET', `/videos/${encodeURIComponent(videoId)}`, {
			itemIndex,
		});
		if (TERMINAL_STATUSES.includes(video.status as string)) return { video, timedOut: false };
		if (Date.now() >= deadline) return { video, timedOut: true };
	}
}
