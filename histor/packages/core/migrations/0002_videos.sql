CREATE TABLE "videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'youtube' NOT NULL,
	"external_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"channel_name" text NOT NULL,
	"language" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"published_at" timestamp with time zone NOT NULL,
	"story_id" bigint,
	"match_score" real,
	"matched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "videos_provider_external_idx" ON "videos" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "videos_story_idx" ON "videos" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "videos_published_idx" ON "videos" USING btree ("published_at");