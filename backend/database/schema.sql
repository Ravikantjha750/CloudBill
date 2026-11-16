CREATE DATABASE IF NOT EXISTS cloud_retail_billing
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE cloud_retail_billing;

-- 1. Users: administrator and cashier accounts
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'CASHIER') NOT NULL DEFAULT 'CASHIER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Product categories
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products and inventory
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NULL,
    name VARCHAR(150) NOT NULL,
    sku VARCHAR(60) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_product_price CHECK (price >= 0),
    CONSTRAINT chk_product_stock CHECK (stock_quantity >= 0),
    CONSTRAINT chk_product_reorder CHECK (reorder_level >= 0)
);

-- 4. Customers
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Sales and invoices
CREATE TABLE IF NOT EXISTS sales (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT NULL,
    cashier_id INT NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_method ENUM(
        'CASH', 'RAZORPAY', 'OTHER'
    ) NOT NULL,
    payment_status ENUM(
        'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'
    ) NOT NULL DEFAULT 'PENDING',
    sale_status ENUM(
        'PENDING', 'COMPLETED', 'CANCELLED'
    ) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_sales_cashier
        FOREIGN KEY (cashier_id)
        REFERENCES users(id),
    INDEX idx_sales_created_at (created_at),
    INDEX idx_sales_payment_status (payment_status)
);

-- 6. Items in each sale
CREATE TABLE IF NOT EXISTS sale_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    sku VARCHAR(60) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    CONSTRAINT fk_sale_items_sale
        FOREIGN KEY (sale_id)
        REFERENCES sales(id),
    CONSTRAINT fk_sale_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id),
    CONSTRAINT chk_sale_item_quantity CHECK (quantity > 0),
    INDEX idx_sale_items_sale (sale_id)
);

-- 7. Payment gateway transactions
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    gateway VARCHAR(30) NOT NULL DEFAULT 'RAZORPAY',
    gateway_order_id VARCHAR(100) UNIQUE,
    gateway_payment_id VARCHAR(100) UNIQUE,
    amount DECIMAL(12, 2) NOT NULL,
    status ENUM(
        'CREATED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'
    ) NOT NULL DEFAULT 'CREATED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_sale
        FOREIGN KEY (sale_id)
        REFERENCES sales(id),
    INDEX idx_payments_sale (sale_id)
);

-- 8. Inventory movement history
CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    user_id INT NULL,
    sale_id BIGINT NULL,
    movement_type ENUM(
        'OPENING', 'PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT'
    ) NOT NULL,
    quantity_change INT NOT NULL,
    stock_after INT NOT NULL,
    notes VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stock_product
        FOREIGN KEY (product_id)
        REFERENCES products(id),
    CONSTRAINT fk_stock_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_stock_sale
        FOREIGN KEY (sale_id)
        REFERENCES sales(id)
        ON DELETE SET NULL,
    INDEX idx_stock_product_date (product_id, created_at)
);

-- 9. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NULL,
    notification_type ENUM(
        'LOW_STOCK', 'OUT_OF_STOCK'
    ) NOT NULL,
    message VARCHAR(255) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE SET NULL,
    INDEX idx_notifications_read (is_read, created_at)
);