# Usage Worker

The page sends one event for each conversion attempt, including failed and empty inputs. Events contain the input link, generated link, solution-check option, result or error, timestamps, and app version. Retries use the same event ID to prevent duplicates. A logging outage does not interrupt conversion.

## Deployment

Sign in to the Cloudflare account used for `cyddrdrd.workers.dev`:

```sh
npx wrangler login
npx wrangler d1 create sudokupad-to-penpa-usage
```

Copy the new database ID into `wrangler.jsonc`, then initialize the table and publish:

```sh
npx wrangler d1 execute sudokupad-to-penpa-usage --remote --file=schema.sql
npx wrangler deploy --env=""
```

The page uses `https://sudokupad-to-penpa-log.cyddrdrd.workers.dev/log`. If a different account is used, update `USAGE_ENDPOINT` in `page.js` to the deployed address.

## View usage

In Cloudflare, open **D1 → sudokupad-to-penpa-usage → Console**, then run:

```sql
SELECT received_at, input_url, output_url, no_solution_check,
       status, input_format, error, version
FROM conversion_events
ORDER BY received_at DESC
LIMIT 100;
```

The Worker has no public endpoint for reading records. It does not store IP addresses or cookies. The schema is safe to apply again without deleting existing records.
