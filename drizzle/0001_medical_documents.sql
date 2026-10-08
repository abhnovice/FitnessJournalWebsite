CREATE TABLE `medical_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`category` text NOT NULL,
	`object_key` text NOT NULL,
	`size_bytes` text NOT NULL,
	`uploaded_at` text NOT NULL
);
CREATE INDEX `medical_documents_user_id_uploaded_at_idx` ON `medical_documents` (`user_id`,`uploaded_at`);
