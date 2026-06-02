# Database Commands

Commandes de gestion de base de données. Exemple en docker :

```bash
docker compose exec api deno task db:setup-dev
```

## 1. `db:migrate` - Exécuter les migrations

Crée/met à jour la structure de la base de données selon les fichiers de
migration.

### Utilisation

```bash
deno task db:migrate
```

### Cas d'usage

- Première initialisation
- Après avoir ajouté une nouvelle migration

---

## 2. `db:populate` - Remplir avec données de test (développement)

Crée des utilisateurs et groupes de test pour le développement.

### Utilisation

```bash
deno task db:populate
```

### Données créées

- 5 utilisateurs (2 admins, 3 membres)
- 3 groupes
- Associations utilisateur-groupe

---

## 3. `db:prune` - Effacer toutes les données (développement)

Supprime **tous les utilisateurs, groupes et données** (préserve la structure et
les rôles).

### Utilisation

**Stage 1 - Confirmer l'action**

```bash
deno task db:prune
# ⚠️  Affiche un avertissement, demande confirmation
```

**Stage 2 - Exécuter réellement**

```bash
CONFIRM_PRUNE=true deno task db:prune
# ✓ Supprime les données
```

### Données supprimées

- Utilisateurs
- Groupes
- Associations (rôles, appartenance ...)
- Données en cascade (ex: projets liés à des groupes)

---

## 4. `db:setup-dev` - Setup complet

Combine migration + population en une commande.

### Utilisation

```bash
deno task db:setup-dev
```

### Équivalent à

```bash
deno task db:migrate && deno task db:populate
```

### Cas d'usage

- Première initialisation du projet
- Reset complet de l'environnement dev

---

## 5. `user:create-admin` - Créer un admin interactif

Crée un nouvel utilisateur avec rôle admin via prompt interactif.

### Utilisation

```bash
deno task user:create-admin
```

### Cas d'usage

- Ajouter un admin nouvellement arrivé
- Créer un compte de test spécifique
