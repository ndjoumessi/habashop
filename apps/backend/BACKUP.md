# Backup Base de Données HabaShop

## Backup automatique Railway
Railway (plan Hobby+) effectue des backups automatiques quotidiens de PostgreSQL.
Rétention : 7 jours.
Accès : railway.app → projet `grateful-happiness` → service Postgres → onglet **Backups**.

## Backup manuel
```bash
# Export complet (depuis une machine ayant accès à DATABASE_URL)
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql

# Restauration
psql "$DATABASE_URL" < backup_YYYYMMDD.sql
```

## Schéma via Prisma
```bash
cd apps/backend
npx prisma db pull   # synchronise schema.prisma depuis la DB
npx prisma migrate deploy  # applique les migrations en attente (ce que fait le Dockerfile au démarrage)
```
> ⚠️ `DATABASE_URL` pointe sur la **production**. Ne jamais lancer `prisma migrate dev`,
> `migrate reset` ni `db push` contre la prod : créer une migration et la laisser
> s'appliquer via `migrate deploy` au déploiement Railway.

## Soft delete
Les modèles `Customer`, `Supplier`, `PurchaseOrder` et `Product` utilisent `deletedAt`
(null = actif). Une suppression met `deletedAt = now()` ; la donnée reste en base et
peut être restaurée via `PATCH /api/<resource>/:id/restore` (ADMIN/SUPER_ADMIN).
Aucune perte de données sur suppression → le backup reste la protection contre la
suppression *physique* accidentelle (migration, intervention manuelle).

## Données de démonstration
```bash
cd apps/backend
npx prisma db seed   # recrée les tenants/utilisateurs de démo (⚠️ écrit en base)
```
