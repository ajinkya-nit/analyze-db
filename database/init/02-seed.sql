
USE analyzedb_demo;

INSERT INTO customers
(first_name, last_name, email, city, country)
VALUES
('Aarav', 'Sharma', 'aarav@example.com', 'Delhi', 'India'),
('Priya', 'Verma', 'priya@example.com', 'Mumbai', 'India'),
('Rahul', 'Mehta', 'rahul@example.com', 'Jalandhar', 'India'),
('Ananya', 'Singh', 'ananya@example.com', 'Chandigarh', 'India'),
('Kabir', 'Malhotra', 'kabir@example.com', 'Amritsar', 'India');

INSERT INTO categories (name, description)
VALUES
('Electronics', 'Electronic devices and accessories'),
('Clothing', 'Fashion and apparel'),
('Books', 'Books and educational material');

INSERT INTO products
(category_id, name, description, price, stock_quantity)
VALUES
(1, 'Laptop', 'Performance laptop', 65000, 20),
(1, 'Smartphone', 'Android smartphone', 25000, 50),
(1, 'Headphones', 'Wireless headphones', 3000, 100),
(2, 'T-Shirt', 'Cotton T-shirt', 799, 150),
(2, 'Jeans', 'Denim jeans', 1999, 80),
(3, 'Database Systems', 'Database engineering book', 899, 40);

INSERT INTO orders
(customer_id, order_date, status, total_amount)
VALUES
(1, '2026-01-10 10:00:00', 'delivered', 68000),
(2, '2026-01-15 11:30:00', 'delivered', 28000),
(3, '2026-02-05 14:00:00', 'shipped', 3396),
(1, '2026-02-12 09:15:00', 'processing', 25000),
(4, '2026-03-01 16:00:00', 'cancelled', 799);

INSERT INTO order_items
(order_id, product_id, quantity, unit_price)
VALUES
(1, 1, 1, 65000),
(1, 3, 1, 3000),
(2, 2, 1, 25000),
(2, 6, 1, 899),
(2, 3, 1, 2101),
(3, 4, 2, 799),
(3, 6, 2, 899),
(4, 2, 1, 25000),
(5, 4, 1, 799);
