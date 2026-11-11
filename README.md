# n8n-nodes-morphedra

An [n8n](https://n8n.io) community node for the [Morphedra Whiteboard Video API](https://morphedra.com/api-docs). It turns scientific and educational figures (PNG, JPG or WEBP) into narrated whiteboard videos.

Send 1 to 6 figures with your own scripts, which the voice reads word for word, or without scripts, in which case the narration is composed from the figures and your optional notes. The API returns at once and makes the video in the background.

Price: $1.80 per minute of finished video, billed per second, shortest charge 10 seconds. A failed video is never charged. Test keys make 3 free watermarked videos of up to 15 seconds per account. Full details: <https://morphedra.com/api-docs>.

## Installation

Self-hosted n8n: open **Settings > Community Nodes > Install** and enter `n8n-nodes-morphedra`. See the [n8n guide to installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

1. Sign in at <https://morphedra.com/developers> and create an API key. Test keys start with `mk_test_`, live keys with `mk_live_`.
2. In n8n, create a **Morphedra API** credential and paste the key into **API Key**.

The key is sent in the `Authorization: Bearer` header and is stored by n8n like any other credential. The credential test calls `GET /v1/balance`.

## Morphedra node

| Resource | Operation | What it does |
| --- | --- | --- |
| Video | Create | Creates a video from 1 to 6 figures. Optional: title, notes, voice, max duration, webhook URL, idempotency key, and waiting until the video is finished. |
| Video | Get | Gets one video by its ID. |
| Video | Get Many | Lists your videos, newest first (all of them, or up to a limit). |
| Video | Cancel | Cancels a video that is still queued. The full hold is returned. |
| Account | Get Balance | Your balance in cents and your test video allowance. |
| Account | Get Usage | Totals and counts by status for the last 1 to 90 days. |

### Create a video

- **Figures**: each figure has an image from a public https **URL** or from **binary data** of a previous node (for example HTTP Request or Read Binary File), and an optional **Script**. Give a script for every figure or for none. Use **Specify Figures > Using JSON** to pass a list built by an earlier node.
- **Max Duration (Seconds)**: from 10 to 600, default 60. This is the most you can be charged for the video. If your scripts cannot fit, the API refuses the request with `script_too_long` before anything is charged.
- **Wait for Video to Finish**: the node asks for the video every 10 seconds until it is completed, failed or cancelled. A video usually takes one to six minutes, longer for long videos, so for long videos use the Morphedra Trigger node instead. If the timeout passes, the node stops with an error; the video keeps running in the background.
- The output is the video object of the API: `id`, `status`, `video_url`, `thumbnail_url`, `transcript`, `cost`, `error` and more. Check `status` when you wait: a failed video is returned with `status` `failed` and an `error` object.

## Morphedra Trigger node

Starts a workflow when a video finishes. Choose **Video Completed**, **Video Failed** or **Video Completed or Failed**.

The trigger checks your videos at the poll interval of the trigger (set in the node) and emits each finished video once. It needs no public address and no webhook secret. When you activate a workflow, videos that are already finished are not emitted; videos that are still running are emitted when they finish. The API allows 30 requests per minute per key, shared with everything else that uses the same key.

Prefer webhooks? Set **Webhook URL** on the Create operation and verify the `morphedra-Signature` header as described in the [webhook documentation](https://morphedra.com/api-docs).

## Limits of the API

- 1 to 6 figures per video, PNG, JPG or WEBP, at most 5 MB each, all landscape or all portrait.
- Videos of 10 to 600 seconds.
- 2 videos running at the same time per account, 30 requests per minute per key.
- Do not send personal health information or other personal identifiers in figures, scripts or notes. See the [API terms](https://morphedra.com/api-terms).

## Resources

- [API documentation](https://morphedra.com/api-docs)
- [OpenAPI file](https://morphedra.com/openapi.json)
- Support: support@morphedra.com

## Development

```
npm install
npm run dev     # starts n8n with the node loaded
npm run lint
npm run build
```

## License

[MIT](LICENSE)
