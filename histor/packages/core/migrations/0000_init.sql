CREATE TABLE "ai_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"task" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"story_id" bigint,
	"ok" boolean DEFAULT true NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"anon_id" text,
	"user_id" uuid,
	"article_id" bigint,
	"story_id" bigint,
	"path" text,
	"language" text,
	"country_code" text,
	"device" text,
	"referrer_host" text,
	"value" real,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_entities" (
	"article_id" bigint NOT NULL,
	"entity_id" integer NOT NULL,
	CONSTRAINT "article_entities_article_id_entity_id_pk" PRIMARY KEY("article_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "article_tags" (
	"article_id" bigint NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "article_tags_article_id_tag_id_pk" PRIMARY KEY("article_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "article_topics" (
	"article_id" bigint NOT NULL,
	"topic_id" integer NOT NULL,
	CONSTRAINT "article_topics_article_id_topic_id_pk" PRIMARY KEY("article_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "article_versions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"article_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"kind" text NOT NULL,
	"headline" text NOT NULL,
	"body" jsonb NOT NULL,
	"verification" jsonb NOT NULL,
	"change_summary" text NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"story_id" bigint NOT NULL,
	"language" text NOT NULL,
	"slug" text NOT NULL,
	"headline" text NOT NULL,
	"subheadline" text,
	"summary" text NOT NULL,
	"body" jsonb NOT NULL,
	"body_text" text NOT NULL,
	"verification" jsonb NOT NULL,
	"sources_list" jsonb NOT NULL,
	"timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_developing" boolean DEFAULT false NOT NULL,
	"is_breaking" boolean DEFAULT false NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"author_id" integer,
	"category_id" text,
	"country_code" text,
	"region_id" integer,
	"city_id" integer,
	"image_id" integer,
	"seo_title" text NOT NULL,
	"seo_description" text NOT NULL,
	"writer" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"reading_minutes" smallint DEFAULT 1 NOT NULL,
	"evidence_confidence" real DEFAULT 0 NOT NULL,
	"importance" real DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retracted_at" timestamp with time zone,
	"retraction_note" text,
	"search_vector" "tsvector"
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text DEFAULT 'desk' NOT NULL,
	"names" jsonb NOT NULL,
	"bio" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category_id" text,
	"verified_identity" boolean DEFAULT false NOT NULL,
	"same_as" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"names" jsonb NOT NULL,
	"slugs" jsonb NOT NULL,
	"sort" smallint DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_opinion" boolean DEFAULT false NOT NULL,
	"keywords" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_code" text NOT NULL,
	"region_id" integer,
	"names" jsonb NOT NULL,
	"slugs" jsonb NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"lat" double precision,
	"lon" double precision,
	"population" integer,
	"timezone" text
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"story_id" bigint NOT NULL,
	"item_id" bigint NOT NULL,
	"language" text NOT NULL,
	"text" text NOT NULL,
	"kind" text NOT NULL,
	"modality" text NOT NULL,
	"attributed_to" text,
	"entities" text[] DEFAULT '{}'::text[] NOT NULL,
	"numbers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"places" text[] DEFAULT '{}'::text[] NOT NULL,
	"quote" jsonb,
	"status" text DEFAULT 'unsupported' NOT NULL,
	"support_score" real DEFAULT 0 NOT NULL,
	"independent_support" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contradictions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"story_id" bigint NOT NULL,
	"field" text NOT NULL,
	"detail" jsonb NOT NULL,
	"severity" text DEFAULT 'major' NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"note" text NOT NULL,
	"version" integer NOT NULL,
	"created_by" text NOT NULL,
	"report_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"names" jsonb NOT NULL,
	"slugs" jsonb NOT NULL,
	"default_language" text NOT NULL,
	"currency" text NOT NULL,
	"timezone" text NOT NULL,
	"continent" text NOT NULL,
	"edition" boolean DEFAULT false NOT NULL,
	"sort" smallint DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"wikidata_id" text,
	"country_code" text,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"story_id" bigint,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone,
	"place" text,
	"lat" double precision,
	"lon" double precision,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_item_id" bigint
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"claim_id" bigint NOT NULL,
	"item_id" bigint NOT NULL,
	"source_id" integer NOT NULL,
	"relation" text NOT NULL,
	"match_score" real NOT NULL,
	"excerpt" text,
	"matched" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"independence_key" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"article_id" bigint,
	"variants" jsonb NOT NULL,
	"metric" text DEFAULT 'read_through_rate' NOT NULL,
	"winner" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fetch_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text NOT NULL,
	"status_code" integer,
	"duration_ms" integer,
	"bytes" integer,
	"items_seen" integer DEFAULT 0 NOT NULL,
	"items_new" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "image_fingerprints" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"phash" text NOT NULL,
	"url" text NOT NULL,
	"source_id" integer,
	"item_id" bigint,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exif_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interest_profiles" (
	"key" text PRIMARY KEY NOT NULL,
	"affinities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"events" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer,
	"user_id" uuid,
	"provider_invoice_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"hosted_invoice_url" text,
	"attempt_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"queue" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"max_attempts" smallint DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"unique_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"native_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"rtl" boolean DEFAULT false NOT NULL,
	"fts_config" text DEFAULT 'simple' NOT NULL,
	"sort" smallint DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'image' NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"license" text NOT NULL,
	"license_url" text,
	"attribution" text NOT NULL,
	"author" text,
	"source_url" text,
	"provider" text NOT NULL,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"is_illustrative" boolean DEFAULT false NOT NULL,
	"caption" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alt" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"phash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"newsletter_id" integer NOT NULL,
	"issue_date" text NOT NULL,
	"subject" text NOT NULL,
	"article_ids" bigint[] NOT NULL,
	"html" text NOT NULL,
	"text_body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"recipients" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"newsletter_id" integer NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirm_token_hash" text,
	"unsubscribe_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "newsletters" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"language" text NOT NULL,
	"country_code" text,
	"city_id" integer,
	"category_id" text,
	"names" jsonb NOT NULL,
	"descriptions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"send_hour_local" smallint DEFAULT 7 NOT NULL,
	"timezone" text NOT NULL,
	"max_items" smallint DEFAULT 5 NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"push_subscription_id" integer,
	"article_id" bigint NOT NULL,
	"channel" text NOT NULL,
	"priority" real NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "mail_outbox" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text_body" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stage" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "price_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"market" text NOT NULL,
	"country_codes" text[] NOT NULL,
	"currency" text NOT NULL,
	"monthly_cents" integer NOT NULL,
	"yearly_cents" integer NOT NULL,
	"trial_days" smallint DEFAULT 0 NOT NULL,
	"stripe_price_monthly" text,
	"stripe_price_yearly" text,
	"active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"language" text NOT NULL,
	"country_code" text,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "quality_reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"story_id" bigint NOT NULL,
	"language" text NOT NULL,
	"passed" boolean NOT NULL,
	"checks" jsonb NOT NULL,
	"writer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"guid" text,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"content_text" text,
	"content_hash" text NOT NULL,
	"minhash" integer[],
	"language" text,
	"author" text,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_date" timestamp with time zone,
	"country_code" text,
	"region_id" integer,
	"city_id" integer,
	"category_id" text,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_url" text,
	"attributed_to" text,
	"copy_of_item_id" bigint,
	"is_demo" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"discard_reason" text,
	"tdm_reserved" boolean DEFAULT false NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_history" (
	"user_id" uuid NOT NULL,
	"article_id" bigint NOT NULL,
	"first_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"max_scroll" real DEFAULT 0 NOT NULL,
	"dwell_seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "reading_history_user_id_article_id_pk" PRIMARY KEY("user_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"profile_key" text NOT NULL,
	"context" text NOT NULL,
	"article_ids" bigint[] NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_code" text NOT NULL,
	"code" text NOT NULL,
	"names" jsonb NOT NULL,
	"slugs" jsonb NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"article_id" bigint,
	"url" text,
	"description" text NOT NULL,
	"reporter_name" text,
	"reporter_email" text,
	"status" text DEFAULT 'open' NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "review_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"priority" smallint DEFAULT 50 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"story_id" bigint,
	"article_id" bigint,
	"report_id" integer,
	"source_id" integer,
	"dedupe_key" text,
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "saved_articles" (
	"user_id" uuid NOT NULL,
	"article_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_articles_user_id_article_id_pk" PRIMARY KEY("user_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mfa_passed" boolean DEFAULT false NOT NULL,
	"user_agent" text,
	"ip_hash" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" bigint NOT NULL,
	"network" text NOT NULL,
	"status" text NOT NULL,
	"text" text NOT NULL,
	"url" text NOT NULL,
	"external_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "source_reliability" (
	"source_id" integer PRIMARY KEY NOT NULL,
	"alpha" real NOT NULL,
	"beta" real NOT NULL,
	"confirmed_count" integer DEFAULT 0 NOT NULL,
	"contradicted_count" integer DEFAULT 0 NOT NULL,
	"corrected_count" integer DEFAULT 0 NOT NULL,
	"copy_count" integer DEFAULT 0 NOT NULL,
	"original_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"homepage_url" text NOT NULL,
	"feed_url" text,
	"connector" text NOT NULL,
	"source_type" text NOT NULL,
	"country_code" text,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"ownership_group" text,
	"is_satire" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"blocked_reason" text,
	"fetch_interval_minutes" integer DEFAULT 15 NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"next_fetch_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"etag" text,
	"last_modified" text,
	"robots_allowed" boolean,
	"tdm_reserved" boolean DEFAULT false NOT NULL,
	"terms_notes" text,
	"license_notes" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category_hint" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"state" text DEFAULT 'DISCOVERED' NOT NULL,
	"headline_hint" text NOT NULL,
	"category_id" text,
	"country_code" text,
	"region_id" integer,
	"city_id" integer,
	"is_breaking" boolean DEFAULT false NOT NULL,
	"is_developing" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_item_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_time" timestamp with time zone,
	"evidence_confidence" real DEFAULT 0 NOT NULL,
	"momentum" real DEFAULT 0 NOT NULL,
	"importance" real DEFAULT 0 NOT NULL,
	"confidence_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"momentum_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"independent_source_count" integer DEFAULT 0 NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"entity_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"centroid" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"blocked_reason" text,
	"locked_by_editor" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retracted_at" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"parent_story_id" bigint
);
--> statement-breakpoint
CREATE TABLE "story_entities" (
	"story_id" bigint NOT NULL,
	"entity_id" integer NOT NULL,
	"salience" real DEFAULT 0 NOT NULL,
	CONSTRAINT "story_entities_story_id_entity_id_pk" PRIMARY KEY("story_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "story_items" (
	"story_id" bigint NOT NULL,
	"item_id" bigint NOT NULL,
	"similarity" real DEFAULT 1 NOT NULL,
	"independence_key" text NOT NULL,
	"is_copy" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_items_story_id_item_id_pk" PRIMARY KEY("story_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subscription_id" text,
	"provider_customer_id" text,
	"plan_id" integer,
	"status" text NOT NULL,
	"interval" text NOT NULL,
	"currency" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"trial_end" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"names" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"names" jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category_id" text,
	"entity_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_follows_user_id_kind_ref_pk" PRIMARY KEY("user_id","kind","ref")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"name" text,
	"role" text DEFAULT 'reader' NOT NULL,
	"language" text,
	"country_code" text,
	"region_id" integer,
	"city_id" integer,
	"timezone" text,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"personalization" boolean DEFAULT true NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"alerts_max_per_day" smallint DEFAULT 3 NOT NULL,
	"quiet_hours_start" smallint DEFAULT 22 NOT NULL,
	"quiet_hours_end" smallint DEFAULT 7 NOT NULL,
	"stripe_customer_id" text,
	"failed_logins" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"story_id" bigint NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state_before" text NOT NULL,
	"state_after" text NOT NULL,
	"evidence_confidence" real NOT NULL,
	"momentum" real NOT NULL,
	"decision" text NOT NULL,
	"reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"thresholds" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "article_entities" ADD CONSTRAINT "article_entities_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_entities" ADD CONSTRAINT "article_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_topics" ADD CONSTRAINT "article_topics_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_topics" ADD CONSTRAINT "article_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors" ADD CONSTRAINT "authors_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_item_id_raw_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."raw_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradictions" ADD CONSTRAINT "contradictions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_item_id_raw_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."raw_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetch_log" ADD CONSTRAINT "fetch_log_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_issues" ADD CONSTRAINT "newsletter_issues_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_reports" ADD CONSTRAINT "quality_reports_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_items" ADD CONSTRAINT "raw_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_articles" ADD CONSTRAINT "saved_articles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_articles" ADD CONSTRAINT "saved_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_reliability" ADD CONSTRAINT "source_reliability_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_entities" ADD CONSTRAINT "story_entities_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_entities" ADD CONSTRAINT "story_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_items" ADD CONSTRAINT "story_items_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_items" ADD CONSTRAINT "story_items_item_id_raw_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."raw_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_price_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."price_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_ts_idx" ON "ai_usage" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "analytics_ts_idx" ON "analytics_events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "analytics_type_ts_idx" ON "analytics_events" USING btree ("type","ts");--> statement-breakpoint
CREATE INDEX "analytics_article_idx" ON "analytics_events" USING btree ("article_id","type");--> statement-breakpoint
CREATE INDEX "article_entities_entity_idx" ON "article_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "article_topics_topic_idx" ON "article_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "article_versions_uq" ON "article_versions" USING btree ("article_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_lang_slug_uq" ON "articles" USING btree ("language","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_story_lang_uq" ON "articles" USING btree ("story_id","language");--> statement-breakpoint
CREATE INDEX "articles_status_pub_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "articles_cat_idx" ON "articles" USING btree ("category_id","published_at");--> statement-breakpoint
CREATE INDEX "articles_country_idx" ON "articles" USING btree ("country_code","published_at");--> statement-breakpoint
CREATE INDEX "articles_search_idx" ON "articles" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "audit_ts_idx" ON "audit_log" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "authors_slug_uq" ON "authors" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cities_country_idx" ON "cities" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "cities_region_idx" ON "cities" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "claims_story_idx" ON "claims" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "contradictions_story_idx" ON "contradictions" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "corrections_article_idx" ON "corrections" USING btree ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entities_slug_uq" ON "entities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "entities_name_idx" ON "entities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "events_story_idx" ON "events" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "evidence_claim_idx" ON "evidence" USING btree ("claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "experiments_key_uq" ON "experiments" USING btree ("key");--> statement-breakpoint
CREATE INDEX "fetch_log_source_ts_idx" ON "fetch_log" USING btree ("source_id","ts");--> statement-breakpoint
CREATE INDEX "image_fp_phash_idx" ON "image_fingerprints" USING btree ("phash");--> statement-breakpoint
CREATE UNIQUE INDEX "image_fp_url_uq" ON "image_fingerprints" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_provider_uq" ON "invoices" USING btree ("provider_invoice_id");--> statement-breakpoint
CREATE INDEX "jobs_ready_idx" ON "jobs" USING btree ("queue","status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_unique_active_uq" ON "jobs" USING btree ("unique_key") WHERE status in ('queued','running');--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_issue_uq" ON "newsletter_issues" USING btree ("newsletter_id","issue_date");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subs_uq" ON "newsletter_subscriptions" USING btree ("newsletter_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "newsletters_slug_uq" ON "newsletters" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_push_idx" ON "notifications" USING btree ("push_subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "mail_outbox_status_idx" ON "mail_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "pipeline_runs_stage_idx" ON "pipeline_runs" USING btree ("stage","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "price_plans_market_uq" ON "price_plans" USING btree ("market");--> statement-breakpoint
CREATE INDEX "quality_reports_story_idx" ON "quality_reports" USING btree ("story_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_items_source_url_uq" ON "raw_items" USING btree ("source_id","canonical_url");--> statement-breakpoint
CREATE INDEX "raw_items_status_idx" ON "raw_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "raw_items_fetched_idx" ON "raw_items" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "raw_items_hash_idx" ON "raw_items" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "reading_history_user_idx" ON "reading_history" USING btree ("user_id","last_read_at");--> statement-breakpoint
CREATE INDEX "recommendations_profile_idx" ON "recommendations" USING btree ("profile_key","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_code_uq" ON "regions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "regions_country_idx" ON "regions" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "review_tasks_status_idx" ON "review_tasks" USING btree ("status","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "review_tasks_dedupe_uq" ON "review_tasks" USING btree ("dedupe_key") WHERE status in ('open','in_progress');--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_posts_uq" ON "social_posts" USING btree ("article_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_slug_uq" ON "sources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sources_status_next_idx" ON "sources" USING btree ("status","next_fetch_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stories_slug_uq" ON "stories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "stories_state_idx" ON "stories" USING btree ("state");--> statement-breakpoint
CREATE INDEX "stories_last_item_idx" ON "stories" USING btree ("last_item_at");--> statement-breakpoint
CREATE INDEX "stories_next_check_idx" ON "stories" USING btree ("next_check_at");--> statement-breakpoint
CREATE INDEX "story_items_item_idx" ON "story_items" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_uq" ON "subscriptions" USING btree ("provider_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_uq" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_slug_uq" ON "topics" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verifications_story_idx" ON "verifications" USING btree ("story_id","run_at");