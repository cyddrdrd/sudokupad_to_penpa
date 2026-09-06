# Usage Worker

The page sends one event for each conversion attempt, including failed and empty inputs. Events contain a numbered ID, input link, generated link, solution-check option, result or error, timestamps, app version, country, region, city, Cloudflare location (`colo`), and browser User-Agent. Retries use the same event ID to prevent duplicates. A logging outage does not interrupt conversion.

## Deployment

The production database is `sudokupad-to-penpa-usage`; its existing ID is set in `wrangler.jsonc`. To update the Worker:

```sh
npx wrangler login
npx wrangler d1 migrations apply sudokupad-to-penpa-usage --remote --env=""
npx wrangler deploy --keep-vars --env=""
```

Migrations are tracked and applied once, preserving existing records. `schema.sql` is a snapshot of the final schema; use the migration command for installations and updates. For a separate installation, first create a database with `npx wrangler d1 create sudokupad-to-penpa-usage` and replace the account and database IDs in the configuration.

The page uses `https://sudokupad-to-penpa-log.cyddrdrd.workers.dev/log`. If a different account is used, update `USAGE_ENDPOINT` in `page.js` to the deployed address.

## Set the viewing token

In Cloudflare, open **Workers & Pages → sudokupad-to-penpa-log → Settings → Runtime variables and secrets → Add variable**. Choose **Secret**, use the name **ADMIN_TOKEN**, enter your chosen viewing token, and deploy the change. The token stays in Cloudflare; do not add it to the frontend or this repository.

## View usage

As in penpa_spoiler, replace `YOUR_TOKEN` in these addresses with your viewing token (URL-encode it if it contains URL punctuation):

- JSON: `https://sudokupad-to-penpa-log.cyddrdrd.workers.dev/admin/logs?token=YOUR_TOKEN`
- CSV: `https://sudokupad-to-penpa-log.cyddrdrd.workers.dev/admin/logs.csv?token=YOUR_TOKEN`

Both return the newest 100 records by default. Add `&limit=500` for up to 500 records. API clients can use an `Authorization: Bearer` header instead of a token in the URL. Treat these token-bearing links as private.

You can also view records through **D1 → sudokupad-to-penpa-usage → Console**:

```sql
SELECT id, received_at AS created_at, country, region, city, colo,
       user_agent, input_url, output_url, no_solution_check,
       status, input_format, error, version
FROM conversion_events
ORDER BY received_at DESC
LIMIT 100;
```

The viewer requires a valid `ADMIN_TOKEN`. Location fields come from [Cloudflare request metadata](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties), not the conversion payload. They are approximate and can be unavailable. `colo` identifies Cloudflare's data centre. The Worker does not store IP addresses or cookies.

`id` is a persistent increasing number; `event_id` still prevents duplicate retries. `created_at` mirrors `received_at`, and `input_type` mirrors `input_format`. `used_clone` is always 0 because this converter does not use a clone Worker. Historical records retain their original contents and receive numbered IDs; their previously unrecorded location/browser fields remain null.
