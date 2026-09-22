# RayDaMS

RayDaMS est une plateforme web de gestion et de partage de mini-jeux (upload, compilation, exécution, consultation des logs) avec gestion des utilisateurs et des groupes.

## Fonctionnalités principales

- Authentification complète (inscription, connexion, refresh token, déconnexion)
- Gestion de profil utilisateur (email, avatar, mot de passe)
- Gestion des groupes (création, adhésion par code, membres, administration)
- Upload de jeux et cycle de build via worker dédié
- Stockage des assets sur MinIO (compatible S3)
- Suivi d’état et logs des builds

## Stack technique

- **Runtime** : Deno
- **Backend API** : Oak, Zod, JWT, Redis, PostgreSQL
- **Frontend** : Oak (serveur SSR simple + pages HTML/JS)
- **Stockage objet** : MinIO
- **Orchestration locale** : Docker Compose

## Architecture du dépôt

```text
.
├── backend/        # API, services métier, migrations, tests
├── frontend/       # Serveur front + pages statiques + scripts
├── compiler/       # Image de compilation (worker build)
├── docker-compose.yml
└── docker-compose.prod.yml
```

## Prérequis

- Docker + Docker Compose
- (Optionnel) Deno 2.x si exécution hors Docker

## Démarrage rapide (recommandé)

1. Copier le fichier d’environnement :

   ```bash
   cp .env.example .env
   ```

2. Démarrer la stack :

   ```bash
   docker compose up --build
   ```

3. Accéder aux services :
   - Frontend : http://localhost:5173
   - API : http://localhost:3000
   - MinIO API : http://localhost:9000
   - MinIO Console : http://localhost:9001

## Variables d’environnement

Le projet se configure via `.env` (base fournie dans `.env.example`).

Variables clés :

- **DB** : `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`
- **Redis** : `REDIS_PASSWORD`
- **MinIO/S3** : `MINIO_USER`, `MINIO_PASSWORD`, `MINIO_STORAGE_BUCKET_NAME`, `PUBLIC_S3_ENDPOINT`
- **Sécurité** : `JWT_SECRET`, `PEPPER_SECRET`, `ACCESS_TOKEN_LIFETIME`, `REFRESH_TOKEN_LIFETIME`, `COOKIE_SECURE`, `COOKIE_SAMESITE`
- **Worker** : `MAX_CONCURRENT`, `BUILD_TIMEOUT_MS`
- **Frontend** : `API_URL`

> En production, utilisez des secrets robustes et ne versionnez jamais le fichier `.env`.

## Développement sans Docker (optionnel)

### Backend

```bash
cd backend
deno task dev
```

### Frontend

```bash
cd frontend
deno task dev
```

## Commandes utiles

### Backend

```bash
cd backend
deno task db:migrate
deno task db:populate
deno task db:setup-dev
deno task user:create-admin
deno task test
```

### Qualité de code

```bash
cd backend && deno fmt --check && deno lint && deno check
cd frontend && deno fmt --check && deno lint
```

## Tests

Les tests backend sont situés dans `backend/tests/`.

```bash
cd backend
deno task test
```

## CI/CD (aperçu)

Le pipeline inclut :

- lint frontend et backend
- tests backend
- build des images (`api`, `front`, `worker`)
- déploiement via `docker-compose.prod.yml`

## Contribution

1. Créer une branche dédiée
2. Implémenter des changements ciblés
3. Exécuter lint + tests
4. Ouvrir une Pull Request avec description claire

## Sécurité

- Ne pas committer de secrets
- Régénérer `JWT_SECRET` et `PEPPER_SECRET` selon l’environnement
- Activer `COOKIE_SECURE=true` en production (HTTPS)

## Licence

Aucune licence explicite n’est actuellement déclarée dans le dépôt.
