CREATE TABLE `category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_name_unique` ON `category` (`name`);--> statement-breakpoint
CREATE TABLE `color` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `color_name_unique` ON `color` (`name`);--> statement-breakpoint
CREATE TABLE `expense` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expense_category_id` integer NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`expense_date` text NOT NULL,
	`payment_method_id` integer NOT NULL,
	`notes` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`voided_at` text,
	`void_reason` text,
	`user_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`expense_category_id`) REFERENCES `expense_category`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "expense_amount_pos" CHECK("expense"."amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `expense_date_idx` ON `expense` (`expense_date`,`status`);--> statement-breakpoint
CREATE TABLE `expense_category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_category_name_unique` ON `expense_category` (`name`);--> statement-breakpoint
CREATE TABLE `payment_method` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_method_name_unique` ON `payment_method` (`name`);--> statement-breakpoint
CREATE TABLE `product` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`reference` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_reference_unique` ON `product` (`reference`);--> statement-breakpoint
CREATE TABLE `purchase` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`supplier_id` integer,
	`purchase_date` text NOT NULL,
	`notes` text,
	`merchandise_total` integer NOT NULL,
	`shipping_cost` integer DEFAULT 0 NOT NULL,
	`other_cost` integer DEFAULT 0 NOT NULL,
	`total_cost` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`voided_at` text,
	`void_reason` text,
	`user_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_number_unique` ON `purchase` (`number`);--> statement-breakpoint
CREATE INDEX `purchase_date_idx` ON `purchase` (`purchase_date`,`status`);--> statement-breakpoint
CREATE TABLE `purchase_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_id` integer NOT NULL,
	`variant_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost` integer NOT NULL,
	`allocated_extra` integer DEFAULT 0 NOT NULL,
	`real_line_total` integer NOT NULL,
	`real_unit_cost` integer NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchase`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "purchase_item_qty_pos" CHECK("purchase_item"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE `sale` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`sale_date` text NOT NULL,
	`customer_name` text,
	`notes` text,
	`payment_method_id` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`total_cost` integer NOT NULL,
	`status` text DEFAULT 'COMPLETED' NOT NULL,
	`voided_at` text,
	`void_reason` text,
	`voided_by` integer,
	`user_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`voided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "sale_discount_valid" CHECK("sale"."discount" >= 0 AND "sale"."discount" <= "sale"."subtotal")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sale_number_unique` ON `sale` (`number`);--> statement-breakpoint
CREATE INDEX `sale_date_idx` ON `sale` (`sale_date`,`status`);--> statement-breakpoint
CREATE TABLE `sale_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`variant_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`line_subtotal` integer NOT NULL,
	`line_discount` integer DEFAULT 0 NOT NULL,
	`line_total` integer NOT NULL,
	`unit_cost` integer NOT NULL,
	`line_cost` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sale`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "sale_item_qty_pos" CHECK("sale_item"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `sale_item_sale_idx` ON `sale_item` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_item_variant_idx` ON `sale_item` (`variant_id`);--> statement-breakpoint
CREATE TABLE `setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `size` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `size_name_unique` ON `size` (`name`);--> statement-breakpoint
CREATE TABLE `stock_movement` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variant_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost` integer NOT NULL,
	`ref_type` text NOT NULL,
	`ref_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variant`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `stock_movement_variant_idx` ON `stock_movement` (`variant_id`);--> statement-breakpoint
CREATE TABLE `supplier` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'ADMIN' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `variant` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`color_id` integer NOT NULL,
	`size_id` integer NOT NULL,
	`sku` text NOT NULL,
	`sale_price` integer DEFAULT 0 NOT NULL,
	`avg_cost` integer DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`color_id`) REFERENCES `color`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`size_id`) REFERENCES `size`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "variant_stock_nonneg" CHECK("variant"."stock" >= 0),
	CONSTRAINT "variant_price_nonneg" CHECK("variant"."sale_price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variant_sku_unique` ON `variant` (`sku`);--> statement-breakpoint
CREATE INDEX `variant_product_idx` ON `variant` (`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `variant_product_color_size` ON `variant` (`product_id`,`color_id`,`size_id`);