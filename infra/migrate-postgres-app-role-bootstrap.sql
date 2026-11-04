\set ON_ERROR_STOP on
\getenv app_password HUB_DB_PASSWORD

SELECT EXISTS (
  SELECT 1
  FROM pg_roles
  WHERE rolname = :'admin_user'
    AND rolsuper
) AS admin_is_superuser
\gset

\if :admin_is_superuser
\else
  \echo 'A migração exige a conta administrativa PostgreSQL (superusuário) original do volume.'
  \quit 3
\endif

SELECT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = :'database'
) AS database_exists
\gset

\if :database_exists
\else
  \echo 'O banco definido em POSTGRES_DB não existe neste volume PostgreSQL.'
  \quit 3
\endif

SELECT EXISTS (
  SELECT 1
  FROM pg_database d
  WHERE d.datname <> :'database'
    AND d.datdba = (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
) AS app_owns_another_database
\gset

\if :app_owns_another_database
  \echo 'HUB_DB_USER já é proprietário de outro banco. Escolha uma conta dedicada antes de migrar.'
  \quit 3
\endif

SELECT EXISTS (
  SELECT 1
  FROM pg_auth_members m
  JOIN pg_roles member_role ON member_role.oid = m.member
  WHERE member_role.rolname = :'app_user'
) AS app_has_role_memberships
\gset

\if :app_has_role_memberships
  \echo 'HUB_DB_USER herda ou pode assumir outro papel. Revise suas associações antes de migrar.'
  \quit 3
\endif

SELECT EXISTS (
  SELECT 1
  FROM pg_database d
  JOIN pg_roles r ON r.oid = d.datdba
  WHERE d.datname = :'database'
    AND r.rolname IN (:'admin_user', :'app_user')
) AS database_owner_is_expected
\gset

\if :database_owner_is_expected
\else
  \echo 'O banco tem outro proprietário. Inspecione o volume antes de migrar a propriedade.'
  \quit 3
\endif

SELECT format(
  'CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_user'
)
\gexec

ALTER ROLE :"app_user"
  WITH LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

SELECT format('ALTER DATABASE %I OWNER TO %I', d.datname, :'app_user')
FROM pg_database d
JOIN pg_roles r ON r.oid = d.datdba
WHERE d.datname = :'database'
  AND r.rolname = :'admin_user'
\gexec
