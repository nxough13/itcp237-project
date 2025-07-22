-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 18, 2025 at 08:34 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `homehaven_dbase`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `log_id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `model_type` varchar(100) DEFAULT NULL,
  `model_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_warnings`
--

CREATE TABLE `admin_warnings` (
  `warning_id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `admin_id` bigint(20) UNSIGNED NOT NULL,
  `warning_type` enum('minor','moderate','severe') NOT NULL DEFAULT 'minor',
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `is_resolved` tinyint(1) DEFAULT 0,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `category_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`category_id`, `name`, `description`, `is_active`, `created_at`) VALUES
(1, 'Living Room', 'Furniture and decor for living spaces', 1, NULL),
(2, 'Bedroom', 'Bedroom furniture and accessories', 1, NULL),
(3, 'Kitchen & Dining', 'Kitchen and dining room essentials', 1, NULL),
(4, 'Bathroom', 'Bathroom fixtures and accessories', 1, NULL),
(5, 'Office', 'Home office furniture and decor', 1, NULL),
(6, 'Outdoor', 'Outdoor furniture and garden decor', 1, NULL),
(7, 'Lighting', 'Lamps, fixtures, and lighting solutions', 1, NULL),
(8, 'Storage', 'Storage solutions and organization', 1, NULL),
(9, 'Wall Art', 'Paintings, prints, and wall decorations', 1, NULL),
(10, 'Seasonal', 'Holiday and seasonal decorations', 1, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `coupons`
--

CREATE TABLE `coupons` (
  `coupon_id` int(11) NOT NULL,
  `code` varchar(50) NOT NULL,
  `type` enum('percentage','fixed_amount') NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `minimum_amount` decimal(10,2) DEFAULT NULL,
  `maximum_discount` decimal(10,2) DEFAULT NULL,
  `usage_limit` int(11) DEFAULT NULL,
  `used_count` int(11) DEFAULT 0,
  `starts_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer`
--

CREATE TABLE `customer` (
  `customer_id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `fname` varchar(32) DEFAULT NULL,
  `lname` varchar(32) NOT NULL,
  `addressline` text DEFAULT NULL,
  `town` varchar(32) DEFAULT NULL,
  `zipcode` char(10) DEFAULT NULL,
  `phone` varchar(16) DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customer`
--

INSERT INTO `customer` (`customer_id`, `user_id`, `fname`, `lname`, `addressline`, `town`, `zipcode`, `phone`, `image_path`, `created_at`) VALUES
(1, 2, 'Neo', 'Neo', 'taguig city', 'Taguig', '1630', '09611676764', '/uploads/profile_2_1752372198760.png', '2025-07-13 01:16:36');

-- --------------------------------------------------------

--
-- Table structure for table `email_notifications`
--

CREATE TABLE `email_notifications` (
  `notification_id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `orderinfo_id` int(11) DEFAULT NULL,
  `email_to` varchar(255) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `type` enum('order_confirmation','order_update','registration','password_reset','other') NOT NULL,
  `status` enum('pending','sent','failed') DEFAULT 'pending',
  `sent_at` timestamp NULL DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `item`
--

CREATE TABLE `item` (
  `item_id` int(11) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `sku` varchar(50) NOT NULL,
  `sell_price` decimal(10,2) NOT NULL,
  `image` text NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `seller_id` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `item`
--

INSERT INTO `item` (`item_id`, `category_id`, `name`, `description`, `sku`, `sell_price`, `image`, `status`, `created_at`, `seller_id`) VALUES
(1, 1, 'Coffee Table', 'Modern coffee table for living room', 'SKU-LVR-002', 649.99, '/jquery/img/Living Room/Coffee Table/CoffeeTable1.jpg, /jquery/img/Living Room/Coffee Table/CoffeeTable2.jpg, /jquery/img/Living Room/Coffee Table/CoffeeTable3.jpg, /jquery/img/Living Room/Coffee Table/CoffeeTable4.jpg, /jquery/img/Living Room/Coffee Table/CoffeeTable5.jpg', 'active', '2025-07-17 07:12:28', 1),
(2, 1, 'Sofa Deluxe', 'Comfortable deluxe sofa', 'SKU-LVR-003', 8999.00, '/jquery/img/Living Room/Sofa Deluxe/SofaDeluxe1.jpg, /jquery/img/Living Room/Sofa Deluxe/SofaDeluxe2.jpg, /jquery/img/Living Room/Sofa Deluxe/SofaDeluxe3.jpg, /jquery/img/Living Room/Sofa Deluxe/SofaDeluxe4.jpg, /jquery/img/Living Room/Sofa Deluxe/SofaDeluxe5.jpg', 'active', '2025-07-17 07:12:28', 1),
(3, 2, 'Nightstand', 'Wooden bedside nightstand', 'SKU-BED-001', 3500.00, '/jquery/img/Bedroom/Nightstand/Nightstand1.jpg, /jquery/img/Bedroom/Nightstand/Nightstand2.jpg, /jquery/img/Bedroom/Nightstand/Nightstand3.jpg, /jquery/img/Bedroom/Nightstand/Nightstand4.jpg, /jquery/img/Bedroom/Nightstand/Nightstand5.jpg', 'active', '2025-07-17 06:52:00', 1),
(4, 2, 'Queen Bed', 'Comfortable queen size bed', 'SKU-BED-002', 12599.99, '/jquery/img/Bedroom/Queen Bed/QueenBed1.jpg, /jquery/img/Bedroom/Queen Bed/QueenBed2.jpg, /jquery/img/Bedroom/Queen Bed/QueenBed3.jpg, /jquery/img/Bedroom/Queen Bed/QueenBed4.jpg, /jquery/img/Bedroom/Queen Bed/QueenBed5.jpg', 'active', '2025-07-17 06:52:00', 1),
(5, 3, 'Bar Stool', 'Adjustable height bar stool', 'SKU-KTD-001', 3500.00, '/jquery/img/Kitchen & Dining/Bar Stool/BarStool1.jpg, /jquery/img/Kitchen & Dining/Bar Stool/BarStool2.jpg, /jquery/img/Kitchen & Dining/Bar Stool/BarStool3.jpg, /jquery/img/Kitchen & Dining/Bar Stool/BarStool4.jpg, /jquery/img/Kitchen & Dining/Bar Stool/BarStool5.jpg', 'active', '2025-07-17 06:52:00', 1),
(6, 3, 'Dining Set', '4-piece dining table set', 'SKU-KTD-002', 10000.00, '/jquery/img/Kitchen & Dining/Dining Set/DiningSet1.jpg, /jquery/img/Kitchen & Dining/Dining Set/DiningSet2.jpg, /jquery/img/Kitchen & Dining/Dining Set/DiningSet3.jpg, /jquery/img/Kitchen & Dining/Dining Set/DiningSet4.jpg, /jquery/img/Kitchen & Dining/Dining Set/DiningSet5.jpg', 'active', '2025-07-17 06:52:00', 1),
(7, 4, 'Bath Mat', 'Soft absorbent bath mat', 'SKU-BTH-001', 1599.99, '/jquery/img/Bathroom/Bath Mat/BathMat1.jpg, /jquery/img/Bathroom/Bath Mat/BathMat2.jpg, /jquery/img/Bathroom/Bath Mat/BathMat3.jpg, /jquery/img/Bathroom/Bath Mat/BathMat4.jpg, /jquery/img/Bathroom/Bath Mat/BathMat5.jpg', 'active', '2025-07-17 06:52:00', 1),
(8, 4, 'Shower Curtain', 'Waterproof shower curtain', 'SKU-BTH-002', 999.99, '/jquery/img/Bathroom/Shower Curtains/ShowerCurtain1.jpg, /jquery/img/Bathroom/Shower Curtains/ShowerCurtain2.jpg, /jquery/img/Bathroom/Shower Curtains/ShowerCurtain3.jpg, /jquery/img/Bathroom/Shower Curtains/ShowerCurtain4.jpg, /jquery/img/Bathroom/Shower Curtains/ShowerCurtain5.jpg', 'active', '2025-07-17 06:52:00', 1),
(9, 5, 'Desk Organizer', 'Multi-compartment desk organizer', 'SKU-OFF-001', 500.00, '/jquery/img/Office/Desk Organizer/DeskOrganizer1.jpg, /jquery/img/Office/Desk Organizer/DeskOrganizer2.jpg, /jquery/img/Office/Desk Organizer/DeskOrganizer3.jpg, /jquery/img/Office/Desk Organizer/DeskOrganizer4.jpg, /jquery/img/Office/Desk Organizer/DeskOrganizer5.jpg', 'active', '2025-07-17 06:52:00', 1),
(10, 5, 'Office Chair', 'Ergonomic office chair', 'SKU-OFF-002', 2500.00, '/jquery/img/Office/Office Chair/OfficeChair1.jpg', 'active', '2025-07-17 06:52:00', 1),
(11, 6, 'Garden Lamp', 'Solar powered garden lamp', 'SKU-OTD-001', 1299.99, '/jquery/img/Outdoor/Garden Lamp/GardenLamp1.jpg', 'active', '2025-07-17 06:52:00', 1),
(12, 6, 'Patio Set', 'Outdoor patio furniture set', 'SKU-OTD-002', 499999.99, '/jquery/img/Outdoor/Patio Set/PatioSet1.jpg', 'active', '2025-07-17 06:52:00', 1),
(13, 7, 'Pendant Light', 'Modern pendant light fixture', 'SKU-LGT-001', 3000.00, '/jquery/img/Lighting/Pendant Light/PendantLight1.jpg', 'active', '2025-07-17 06:52:00', 1),
(14, 7, 'Table Lamp', 'Adjustable table lamp', 'SKU-LGT-002', 1800.00, '/jquery/img/Lighting/Table Lamp/TableLamp1.jpg', 'active', '2025-07-17 06:52:00', 1),
(15, 8, 'Bookshelf', '5-tier wooden bookshelf', 'SKU-STR-001', 6000.00, '/jquery/img/Storage/Bookshelf/Bookshelf1.jpg', 'active', '2025-07-17 06:52:00', 1),
(16, 8, 'Storage Box', 'Collapsible storage box', 'SKU-STR-002', 800.00, '/jquery/img/Storage/Storage Box/StorageBox1.jpg', 'active', '2025-07-17 06:52:00', 1),
(17, 9, 'Canvas Art', 'Abstract canvas wall art', 'SKU-WAT-001', 2500.00, '/jquery/img/Wall Art/Canvas Art/CanvasArt1.jpg', 'active', '2025-07-17 06:52:00', 1),
(18, 9, 'Wall Clock', 'Modern wall clock design', 'SKU-WAT-002', 1400.00, '/jquery/img/Wall Art/Wall Clock/WallClock1.jpg', 'active', '2025-07-17 06:52:00', 1),
(19, 10, 'Christmas Tree', 'Artificial Christmas tree', 'SKU-SEA-001', 5500.00, '/jquery/img/Seasonal/Christmas Tree/ChristmasTree1.jpg', 'active', '2025-07-17 06:52:02', 1),
(20, 10, 'Pumpkin Decor', 'Halloween pumpkin decoration', 'SKU-SEA-002', 75.00, '/jquery/img/Seasonal/Pumpkin Decor/PumpkinDecor1.jpg', 'active', '2025-07-17 06:52:02', 1),
(21, 2, 'item2', '', 'SKU', 199.00, '[\"/uploads/product_1752768165043_586474378.png\",\"/uploads/product_1752768165079_17149111.png\"]', 'active', '2025-07-17 07:43:43', 3);

-- --------------------------------------------------------

--
-- Table structure for table `orderinfo`
--

CREATE TABLE `orderinfo` (
  `orderinfo_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `order_number` varchar(50) NOT NULL,
  `date_placed` datetime NOT NULL DEFAULT current_timestamp(),
  `status` enum('pending','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `payment_status` enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
  `payment_method` varchar(50) DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `shipping` decimal(10,2) DEFAULT 0.00,
  `total_amount` decimal(10,2) NOT NULL,
  `ship_fname` varchar(50) DEFAULT NULL,
  `ship_lname` varchar(50) DEFAULT NULL,
  `ship_address` text DEFAULT NULL,
  `ship_town` varchar(50) DEFAULT NULL,
  `ship_zipcode` char(10) DEFAULT NULL,
  `ship_phone` varchar(16) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orderline`
--

CREATE TABLE `orderline` (
  `orderline_id` int(11) NOT NULL,
  `orderinfo_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `role_upgrades`
--

CREATE TABLE `role_upgrades` (
  `upgrade_id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `from_role` enum('user','customer','seller','admin') NOT NULL,
  `to_role` enum('user','customer','seller','admin') NOT NULL,
  `upgraded_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sellers`
--

CREATE TABLE `sellers` (
  `seller_id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `business_name` varchar(255) NOT NULL,
  `business_description` text DEFAULT NULL,
  `business_address` text DEFAULT NULL,
  `business_phone` varchar(16) DEFAULT NULL,
  `business_email` varchar(255) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sellers`
--

INSERT INTO `sellers` (`seller_id`, `user_id`, `business_name`, `business_description`, `business_address`, `business_phone`, `business_email`, `is_verified`, `created_at`) VALUES
(1, 3, 'Sample Seller Store', 'We sell home goods.', '123 Main St, City', '09171234567', 'seller1@homehaven.com', 1, '2025-07-14 19:12:56');

-- --------------------------------------------------------

--
-- Table structure for table `shopping_cart`
--

CREATE TABLE `shopping_cart` (
  `cart_id` int(11) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `item_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock`
--

CREATE TABLE `stock` (
  `item_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT 0,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stock`
--

INSERT INTO `stock` (`item_id`, `quantity`, `updated_at`) VALUES
(1, 10, '2025-07-14 19:12:58'),
(2, 10, '2025-07-14 19:12:58'),
(3, 10, '2025-07-14 19:12:58'),
(4, 10, '2025-07-14 19:12:58'),
(5, 10, '2025-07-14 19:12:58'),
(6, 10, '2025-07-14 19:12:58'),
(7, 10, '2025-07-14 19:12:58'),
(8, 10, '2025-07-14 19:12:58'),
(9, 10, '2025-07-14 19:12:58'),
(10, 10, '2025-07-14 19:12:58'),
(11, 10, '2025-07-14 19:12:58'),
(12, 10, '2025-07-14 19:12:58'),
(13, 10, '2025-07-14 19:12:58'),
(14, 10, '2025-07-14 19:12:58');



-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('user','customer','seller','admin') NOT NULL DEFAULT 'user',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `profile_image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `status`, `profile_image`, `created_at`) VALUES
(1, 'Admin User', 'admin@homehaven.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active', NULL, NULL),
(2, 'Neo', 'johnbagon4@gmail.com', 'passwOrd&123', 'customer', 'active', NULL, '2025-07-13 01:11:02'),
(3, 'Sample Seller', 'seller1@homehaven.com', 'password123!', 'seller', 'active', NULL, '2025-07-14 19:12:56'),
(4, 'test1', 'princenatsu07@gmail.com', 'passwOrd&123', 'user', 'active', NULL, '2025-07-14 19:49:15');

-- --------------------------------------------------------

--
-- Table structure for table `wishlist`
--

CREATE TABLE `wishlist` (
  `wishlist_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `admin_warnings`
--
ALTER TABLE `admin_warnings`
  ADD PRIMARY KEY (`warning_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `admin_id` (`admin_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`category_id`);

--
-- Indexes for table `coupons`
--
ALTER TABLE `coupons`
  ADD PRIMARY KEY (`coupon_id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `customer`
--
ALTER TABLE `customer`
  ADD PRIMARY KEY (`customer_id`),
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- Indexes for table `email_notifications`
--
ALTER TABLE `email_notifications`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `orderinfo_id` (`orderinfo_id`);

--
-- Indexes for table `item`
--
ALTER TABLE `item`
  ADD PRIMARY KEY (`item_id`),
  ADD UNIQUE KEY `sku` (`sku`),
  ADD KEY `category_id` (`category_id`),
  ADD KEY `seller_id` (`seller_id`);

--
-- Indexes for table `orderinfo`
--
ALTER TABLE `orderinfo`
  ADD PRIMARY KEY (`orderinfo_id`),
  ADD UNIQUE KEY `order_number` (`order_number`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indexes for table `orderline`
--
ALTER TABLE `orderline`
  ADD PRIMARY KEY (`orderline_id`),
  ADD KEY `orderinfo_id` (`orderinfo_id`),
  ADD KEY `item_id` (`item_id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  ADD KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`);

--
-- Indexes for table `role_upgrades`
--
ALTER TABLE `role_upgrades`
  ADD PRIMARY KEY (`upgrade_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `upgraded_by` (`upgraded_by`);

--
-- Indexes for table `sellers`
--
ALTER TABLE `sellers`
  ADD PRIMARY KEY (`seller_id`),
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- Indexes for table `shopping_cart`
--
ALTER TABLE `shopping_cart`
  ADD PRIMARY KEY (`cart_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `item_id` (`item_id`);

--
-- Indexes for table `stock`
--
ALTER TABLE `stock`
  ADD PRIMARY KEY (`item_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`);

--
-- Indexes for table `wishlist`
--
ALTER TABLE `wishlist`
  ADD PRIMARY KEY (`wishlist_id`),
  ADD UNIQUE KEY `unique_customer_item` (`customer_id`,`item_id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `item_id` (`item_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `admin_warnings`
--
ALTER TABLE `admin_warnings`
  MODIFY `warning_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `coupons`
--
ALTER TABLE `coupons`
  MODIFY `coupon_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer`
--
ALTER TABLE `customer`
  MODIFY `customer_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `email_notifications`
--
ALTER TABLE `email_notifications`
  MODIFY `notification_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `item`
--
ALTER TABLE `item`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `orderinfo`
--
ALTER TABLE `orderinfo`
  MODIFY `orderinfo_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `orderline`
--
ALTER TABLE `orderline`
  MODIFY `orderline_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `role_upgrades`
--
ALTER TABLE `role_upgrades`
  MODIFY `upgrade_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sellers`
--
ALTER TABLE `sellers`
  MODIFY `seller_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `shopping_cart`
--
ALTER TABLE `shopping_cart`
  MODIFY `cart_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `wishlist`
--
ALTER TABLE `wishlist`
  MODIFY `wishlist_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `activity_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `admin_warnings`
--
ALTER TABLE `admin_warnings`
  ADD CONSTRAINT `warnings_admin_fk` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `warnings_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `customer`
--
ALTER TABLE `customer`
  ADD CONSTRAINT `customer_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `email_notifications`
--
ALTER TABLE `email_notifications`
  ADD CONSTRAINT `email_order_fk` FOREIGN KEY (`orderinfo_id`) REFERENCES `orderinfo` (`orderinfo_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `email_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `item`
--
ALTER TABLE `item`
  ADD CONSTRAINT `item_category_fk` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `item_seller_fk` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `orderinfo`
--
ALTER TABLE `orderinfo`
  ADD CONSTRAINT `orderinfo_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`customer_id`) ON DELETE CASCADE;

--
-- Constraints for table `orderline`
--
ALTER TABLE `orderline`
  ADD CONSTRAINT `orderline_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `item` (`item_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orderline_orderinfo_id_fk` FOREIGN KEY (`orderinfo_id`) REFERENCES `orderinfo` (`orderinfo_id`) ON DELETE CASCADE;

--
-- Constraints for table `role_upgrades`
--
ALTER TABLE `role_upgrades`
  ADD CONSTRAINT `role_upgrades_upgraded_by_fk` FOREIGN KEY (`upgraded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `role_upgrades_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sellers`
--
ALTER TABLE `sellers`
  ADD CONSTRAINT `sellers_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `shopping_cart`
--
ALTER TABLE `shopping_cart`
  ADD CONSTRAINT `cart_item_fk` FOREIGN KEY (`item_id`) REFERENCES `item` (`item_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `cart_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock`
--
ALTER TABLE `stock`
  ADD CONSTRAINT `stock_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `item` (`item_id`) ON DELETE CASCADE;

--
-- Constraints for table `wishlist`
--
ALTER TABLE `wishlist`
  ADD CONSTRAINT `wishlist_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `wishlist_item_fk` FOREIGN KEY (`item_id`) REFERENCES `item` (`item_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
CREATE TABLE reviews (
  review_id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  customer_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES item(item_id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE CASCADE,
  UNIQUE KEY unique_review (item_id, customer_id)
);

ALTER TABLE orderinfo
  ADD COLUMN gcash_phone VARCHAR(32) DEFAULT NULL,
  ADD COLUMN gcash_receipt VARCHAR(255) DEFAULT NULL;