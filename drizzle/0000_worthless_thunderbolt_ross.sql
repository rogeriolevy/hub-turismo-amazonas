CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`interest` text NOT NULL,
	`message` text NOT NULL,
	`consent_at` text NOT NULL,
	`privacy_version` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contacts_idempotency` ON `contacts` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_contacts_created` ON `contacts` (`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_window` ON `rate_limits` (`window`);