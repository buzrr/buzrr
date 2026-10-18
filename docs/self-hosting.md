# Self-hosting Buzrr

Run the whole of Buzrr on your own machine — a laptop, a school server, a VPS —
with one command and no accounts anywhere. Once the images are built, nothing
needs the internet.

## What you need

- Docker with Compose **v2.24 or newer** (`docker compose version`).
- About 4 GB of free RAM while the images build (much less to run).
- Free ports 3000 (web) and 3001 (API). Postgres (5432) and Redis (6379) are
  published too, for backups and debugging.

## Start it

```sh
git clone https://github.com/buzrr/buzrr && cd buzrr
docker compose up -d
```

The first run builds two images and takes a few minutes. When it's done, open
**http://localhost:3000**, create an account, and start making quizzes.

What you just started:

| Service       | What it does                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `postgres`    | Quizzes, accounts, results (volume `buzrr-postgres-data`).                                        |
| `redis`       | Live game state (volume `buzrr-redis-data`).                                                      |
| `auth-secret` | Runs once: generates the secret that signs logins (volume `buzrr-secrets`).                       |
| `migrate`     | Runs once per start: creates or upgrades the database, and seeds a starter set of duel questions. |
| `server`      | The API and the real-time game engine on :3001. Question images live on volume `buzrr-uploads`.   |
| `web`         | The site on :3000.                                                                                |

Nothing here talks to an outside service: sign-in is local email + password,
images are stored on disk, billing is off (every account gets the full "Pro"
limits), and AI stays off until you configure a model.

## Configure it

Settings go in a file named `.env` next to `docker-compose.yml` (the repo's
`.env.example` lists them all). Apply changes with:

```sh
docker compose up -d            # runtime settings
docker compose up -d --build    # if you changed PUBLIC_API_URL, PUBLIC_WEB_URL or PUBLIC_AI_API_URL
```

### Serving other computers (a classroom or LAN)

Browsers need addresses they can reach. If the server is `quiz.school.lan`:

```dotenv
PUBLIC_WEB_URL=http://quiz.school.lan:3000
PUBLIC_API_URL=http://quiz.school.lan:3001
```

then `docker compose up -d --build`. `PUBLIC_API_URL` is compiled into the web
app, which is why it needs the rebuild. Players join from any device on the
network — no account needed to play.

For the public internet, put a reverse proxy with HTTPS (Caddy, nginx,
Traefik) in front of both ports and use `https://` URLs here.

### Accounts

- Anyone can register by default. Once your teachers have accounts, close
  registration: `AUTH_EMAIL_SIGNUP=OFF`.
- Want Google sign-in as well? Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  (redirect URI: `<PUBLIC_WEB_URL>/api/auth/callback/google`).
- There is no email, so there is no "forgot password" yet — choose passwords
  you'll keep. (A self-service reset for operators is future work.)

### Making yourself an admin

Admins moderate the public question pool; the superadmin can promote others
from the app. Make your own account superadmin once:

```sh
docker compose exec postgres psql -U buzrr -c \
  "UPDATE users SET role = 'superadmin' WHERE email = 'you@school.org'"
```

### Question images

Stored on the `buzrr-uploads` volume by default and served by the API at
`/uploads`. To use object storage instead, see `apps/server/.env.example`:

- **S3-compatible** (AWS S3, Cloudflare R2, Backblaze B2, SeaweedFS, Garage, …):
  `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_URL` if browsers reach the bucket at a
  different address. The bucket must allow public reads.
- **Cloudinary**: `STORAGE_DRIVER=cloudinary` and `CLOUDINARY_*`.

Images already uploaded stay where they were; only new uploads go to the new
store.

### AI quiz generation and Knowledge Spaces

Off by default. Give Buzrr a model, either:

- **Gemini** — `GEMINI_API_KEY=…` (needs the internet), or
- **Any OpenAI-compatible server** — OpenAI, vLLM, LM Studio, or the bundled
  Ollama, which runs entirely on your hardware:

  ```sh
  docker compose --profile ollama up -d
  docker compose exec ollama ollama pull llama3.1          # needs internet once
  docker compose exec ollama ollama pull nomic-embed-text
  ```

  ```dotenv
  LLM_BASE_URL=http://ollama:11434/v1
  LLM_MODEL=llama3.1
  AI_GENERATION_MODEL=llama3.1
  AI_EMBEDDING_MODEL=nomic-embed-text
  ```

That turns on **AI quiz generation** (describe a topic, get a quiz). For
**Knowledge Spaces** (upload PDFs/DOCX and generate questions from them) also
start the AI service and show it in the UI:

```dotenv
PUBLIC_AI_API_URL=http://localhost:3002
```

```sh
docker compose --profile ai --profile ollama up -d --build
```

Knowledge Spaces needs a 768-dimension embedding model (`nomic-embed-text` is
one); the service refuses others with a message saying so. Local models are
slower and less reliable than hosted ones at following the quiz format — if a
generation fails, try again or use a larger model.

### Big rooms

How many players fit in a room is set on the **server**:

- `MAX_PLAYERS_NOBILLING` — without billing (the self-hosted default), every
  host's room size (default `250`).
- `MAX_PLAYERS_FREE` / `MAX_PLAYERS_PRO` — with `BILLING=ON`, per plan
  (defaults `50` / `250`). A user's `hostSizeLimit` (database) can raise it
  for one account.

`DB_POOL_MAX` sets how many PostgreSQL connections one server process keeps
open (default `10`, the `pg` driver's default). It matters when many players
join at the same moment — a QR code on the screen: each join briefly takes the
room's lock (so the room can't overfill) while holding a connection, and the
joins of one room queue behind each other. With too small a pool, everything
else the server does (sign-ins, the host's lobby, game results) waits behind
that queue too, and the player count on the host screen seems stuck until the
crowd is through. A bigger pool lets that work run alongside.

Rough values for the largest crowd you expect to join **at once**:

| Players joining at once | `DB_POOL_MAX`  |
| ----------------------- | -------------- |
| up to ~100              | `10` (default) |
| ~100–300                | `20`           |
| ~300–1000               | `30`–`50`      |

Keep the sum of all pools under PostgreSQL's `max_connections` (default
`100`), with room to spare: every server process × `DB_POOL_MAX`, plus the web
app (about 10), plus a few for migrations and backups. More connections than
that don't make joins faster — the room's lock serializes them anyway (a few
milliseconds each, so 1000 joins take a few seconds) — they only keep the rest
of the server responsive meanwhile.

`MAX_PARALLEL_DOWNLOADS` (formerly `MAX_PARALLEL_AUDIO_DOWNLOADS`, still
read) rations the downloads devices make ahead of time: at most that many
devices per room fetch the next question's encrypted audio clips and picture
at the same time (and, as a separate pool, the audio skin's files when they
join),
the others queue and start as slots free up (a device finishes, leaves, or
sends no progress for 8 s). Unset or `0` = no limit. Without it, 500 phones
start the same download within three seconds, and on a modest uplink many of
them time out. Around `30` keeps each download fast; a 64 kbit/s clip is
small, so the whole room is through in seconds. When the countdown is over
and devices are still downloading, the host sees "Audio downloads: x of y
done" and chooses: go on now, or wait until every download is done (instead
of the usual 30 s limit).

## Upgrade

```sh
git pull
docker compose up -d --build
```

The `migrate` step applies any new database migrations before the API starts.

## Back up

Everything worth keeping is in two volumes (named after the folder you cloned
into — `buzrr_…` below; `docker volume ls` shows yours):

```sh
docker compose exec postgres pg_dump -U buzrr buzrr > buzrr-$(date +%F).sql
docker run --rm -v buzrr_buzrr-uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

Keep the `buzrr-secrets` volume too (or set `BETTER_AUTH_SECRET` yourself): if
it is lost, everyone is signed out — no data is lost.

## Stop, restart, remove

```sh
docker compose stop          # stop; data is kept
docker compose up -d         # start again
docker compose down -v       # remove everything, including all data
```

## Troubleshooting

- **A service won't start** — `docker compose ps` shows which; `docker compose
logs <service>` says why.
- **`migrate` fails on a database you've used for development** — databases
  created by `yarn setup` (`db push`) are adopted automatically; if yours has a
  partial migration history from elsewhere, start from a fresh volume.
- **Images don't load on other devices** — `PUBLIC_API_URL` must be an address
  those devices can reach, and the web image must be rebuilt after changing it.
- **Port already in use** — something else (perhaps `yarn dev`) has 3000/3001;
  stop it, or change the published ports in `docker-compose.yml`.

Developing Buzrr rather than running it? See the README's "Develop locally" —
that path uses only the `postgres` and `redis` services from this setup.
