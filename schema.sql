-- ============================================================
-- SCHEMA FORMATIONS FTSI — Planning uniquement (sans authentification)
-- À exécuter dans Supabase SQL Editor
-- (Project → SQL Editor → New query → coller tout → Run)
-- ============================================================

create extension if not exists "pgcrypto";

-- ===== TABLE: categories =====
create table if not exists public.categories (
  id text primary key,
  nom text unique not null,
  couleur text default '#2563EB'
);

-- ===== TABLE: formations =====
create table if not exists public.formations (
  id text primary key,
  categorie_id text references public.categories(id) on delete set null,
  description text,
  date_debut timestamptz,
  date_fin timestamptz,
  lieu text,
  formateurs text,
  places_max integer default 10,
  statut text default 'validee',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===== TABLE: notifications =====
-- Historique des créations / modifications / suppressions / annulations
create table if not exists public.notifications (
  id text primary key,
  formation_id text,
  type text not null,              -- 'creation' | 'modification' | 'suppression' | 'annulation'
  message text not null,
  lue boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — accès ouvert via la clé anon publique
-- ============================================================
alter table public.categories enable row level security;
alter table public.formations enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "allow all categories" on public.categories;
create policy "allow all categories" on public.categories for all using (true) with check (true);

drop policy if exists "allow all formations" on public.formations;
create policy "allow all formations" on public.formations for all using (true) with check (true);

drop policy if exists "allow all notifications" on public.notifications;
create policy "allow all notifications" on public.notifications for all using (true) with check (true);

-- Index pour les performances
create index if not exists idx_formations_dates on public.formations(date_debut, date_fin);
create index if not exists idx_notifications_created on public.notifications(created_at desc);

-- ============================================================
-- DONNÉES INITIALES — Catégories FTSI
-- ============================================================
insert into public.categories (id, nom, couleur) values
  ('cat_1','SIG','#2563EB'),
  ('cat_2','SIG - Stains','#DC2626'),
  ('cat_3','GLOCK','#16A34A'),
  ('cat_4','DIVA','#D97706'),
  ('cat_5','TDI','#9333EA'),
  ('cat_6','PPI','#0891B2'),
  ('cat_7','TIREURS QUALIFIÉS','#DB2777'),
  ('cat_8','OTUAS NIV 1','#65A30D'),
  ('cat_9','OTUAS NIV 2','#7C3AED'),
  ('cat_10','STAGES','#0D9488'),
  ('cat_11','ROC','#2563EB'),
  ('cat_12','EXERCICE PRU','#DC2626'),
  ('cat_13','ENTRAÎNEMENT STHI','#16A34A'),
  ('cat_14','ENTRAÎNEMENT MROP','#D97706'),
  ('cat_15','EVA NIV 1','#9333EA'),
  ('cat_16','EVA NIV 2','#0891B2'),
  ('cat_17','EVA NIV 3','#DB2777'),
  ('cat_18','TIR LASER','#65A30D'),
  ('cat_19','TASER - RECYCLAGE','#7C3AED'),
  ('cat_20','TASER - HABILITATION','#0D9488'),
  ('cat_21','HK G36 - RECYCLAGE','#2563EB'),
  ('cat_22','HK G36 - HABILITATION','#DC2626'),
  ('cat_23','LBD - RECYCLAGE','#16A34A'),
  ('cat_24','LBD - HABILITATION','#D97706'),
  ('cat_25','BÂTON - RECYCLAGE','#9333EA'),
  ('cat_26','BÂTON - HABILITATION','#0891B2'),
  ('cat_27','GRENADES - RECYCLAGE','#DB2777'),
  ('cat_28','GRENADES - HABILITATION','#65A30D'),
  ('cat_29','COBRA - RECYCLAGE','#7C3AED'),
  ('cat_30','COBRA - HABILITATION','#0D9488'),
  ('cat_31','CONDOR - RECYCLAGE','#2563EB'),
  ('cat_32','CONDOR - HABILITATION','#DC2626'),
  ('cat_33','COUGARD - RECYCLAGE','#16A34A'),
  ('cat_34','COUGARD - HABILITATION','#D97706'),
  ('cat_35','GENL - RECYCLAGE','#9333EA'),
  ('cat_36','GENL - HABILITATION','#0891B2'),
  ('cat_37','OPÉRATEURS SPI 4G - RECYCLAGE','#DB2777'),
  ('cat_38','OPÉRATEURS SPI 4G - HABILITATION','#65A30D'),
  ('cat_39','PPI CHEF - RECYCLAGE','#7C3AED'),
  ('cat_40','PPI CHEF - HABILITATION','#0D9488'),
  ('cat_41','TIKKA - RECYCLAGE','#2563EB'),
  ('cat_42','TIKKA - HABILITATION','#DC2626'),
  ('cat_43','ADMINISTRATIF','#16A34A')
on conflict (id) do nothing;
