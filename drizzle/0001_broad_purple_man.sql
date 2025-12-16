CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tripId` int,
	`documentCategory` enum('flight','carRental','accommodation','medical','event','other') NOT NULL,
	`documentType` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(255),
	`details` json,
	`documentDate` timestamp,
	`originalFileUrl` text,
	`originalFileName` varchar(255),
	`originalFileMimeType` varchar(100),
	`source` enum('upload','email','camera') NOT NULL DEFAULT 'upload',
	`emailSubject` varchar(500),
	`contentHash` varchar(64),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `forwardingEmail` varchar(320);