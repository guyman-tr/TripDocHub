ALTER TABLE `users` ADD `credits` int DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `paymentCustomerId` varchar(255);