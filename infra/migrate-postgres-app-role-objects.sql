\set ON_ERROR_STOP on

SELECT EXISTS (
  SELECT 1 FROM pg_namespace WHERE nspname = 'public'
) AS public_schema_exists
\gset

\if :public_schema_exists
\else
  \echo 'O schema public não existe no banco configurado; nenhuma propriedade foi transferida.'
  \quit 3
\endif

BEGIN;

ALTER SCHEMA public OWNER TO :"app_user";

SELECT format('ALTER TABLE %I.%I OWNER TO %I', n.nspname, c.relname, :'app_user')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND c.relowner <> (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = c.oid
      AND d.deptype = 'e'
  )
ORDER BY c.relname
\gexec

SELECT format('ALTER SEQUENCE %I.%I OWNER TO %I', n.nspname, c.relname, :'app_user')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'S'
  AND c.relowner <> (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = c.oid
      AND d.deptype = 'e'
  )
ORDER BY c.relname
\gexec

SELECT CASE p.prokind
    WHEN 'p' THEN format(
      'ALTER PROCEDURE %I.%I(%s) OWNER TO %I',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid),
      :'app_user'
    )
    WHEN 'a' THEN format(
      'ALTER AGGREGATE %I.%I(%s) OWNER TO %I',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid),
      :'app_user'
    )
    ELSE format(
      'ALTER FUNCTION %I.%I(%s) OWNER TO %I',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid),
      :'app_user'
    )
  END
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind IN ('f', 'p', 'a')
  AND p.proowner <> (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    WHERE d.classid = 'pg_proc'::regclass
      AND d.objid = p.oid
      AND d.deptype = 'e'
  )
ORDER BY p.proname, p.oid
\gexec

SELECT CASE t.typtype
    WHEN 'd' THEN format('ALTER DOMAIN %I.%I OWNER TO %I', n.nspname, t.typname, :'app_user')
    ELSE format('ALTER TYPE %I.%I OWNER TO %I', n.nspname, t.typname, :'app_user')
  END
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typtype IN ('c', 'd', 'e', 'm', 'r')
  AND t.typowner <> (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    WHERE d.classid = 'pg_type'::regclass
      AND d.objid = t.oid
      AND d.deptype = 'e'
  )
ORDER BY t.typname
\gexec

COMMIT;
