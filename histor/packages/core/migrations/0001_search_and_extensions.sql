-- Búsqueda full-text por idioma (configuración de cada idioma en languages.fts_config)
-- y extensiones. Se hace con disparador y no con columna generada porque la
-- configuración depende del idioma de la fila.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION histor_article_tsv() RETURNS trigger AS $$
DECLARE
  cfg regconfig;
BEGIN
  SELECT fts_config::regconfig INTO cfg FROM languages WHERE code = NEW.language;
  IF cfg IS NULL THEN
    cfg := 'simple'::regconfig;
  END IF;
  NEW.search_vector :=
    setweight(to_tsvector(cfg, coalesce(NEW.headline, '')), 'A') ||
    setweight(to_tsvector(cfg, coalesce(NEW.subheadline, '')), 'B') ||
    setweight(to_tsvector(cfg, coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector(cfg, coalesce(NEW.body_text, '')), 'C') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(NEW.headline, '')), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER articles_tsv_trg BEFORE INSERT OR UPDATE OF headline, subheadline, summary, body_text, language
ON articles FOR EACH ROW EXECUTE FUNCTION histor_article_tsv();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS entities_name_trgm_idx ON entities USING gin (name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS raw_items_title_trgm_idx ON raw_items USING gin (title gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS articles_published_live_idx ON articles (published_at DESC) WHERE status = 'published' AND is_demo = false;
