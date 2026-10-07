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
