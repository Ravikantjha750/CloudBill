from flask import Blueprint, request, jsonify
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import datetime
from app.db import get_db_connection
import secrets

sales_bp = Blueprint("sales", __name__)


def money(value):
    """Round a monetary value to two decimal places."""
    return Decimal(str(value)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP
    )


@sales_bp.route("/api/sales/checkout", methods=["POST"])
def checkout():
    connection = None
    cursor = None

    try:
        data = request.get_json(silent=True) or {}
        items = data.get("items", [])

        if not isinstance(items, list) or not items:
            return jsonify({
                "success": False,
                "message": "Your cart is empty."
            }), 400

        # Validate discount and tax rates.
        try:
            discount_rate = Decimal(str(data.get("discount", 0)))
            tax_rate = Decimal(str(data.get("tax_rate", 0)))
        except (InvalidOperation, ValueError):
            return jsonify({
                "success": False,
                "message": "Invalid discount or tax rate."
            }), 400

        if (
            not discount_rate.is_finite()
            or not tax_rate.is_finite()
            or discount_rate < 0
            or discount_rate > 100
            or tax_rate < 0
            or tax_rate > 100
        ):
            return jsonify({
                "success": False,
                "message": "Discount and tax must be between 0 and 100."
            }), 400

        # Validate and combine duplicate product IDs.
        quantities = {}

        for item in items:
            try:
                product_id = int(item.get("product_id"))
                quantity = int(item.get("quantity"))
            except (TypeError, ValueError, AttributeError):
                return jsonify({
                    "success": False,
                    "message": "Invalid product ID or quantity."
                }), 400

            if product_id <= 0 or quantity <= 0:
                return jsonify({
                    "success": False,
                    "message": "Product IDs and quantities must be positive."
                }), 400

            quantities[product_id] = (
                quantities.get(product_id, 0) + quantity
            )

        connection = get_db_connection()
        cursor = connection.cursor()

        # Find an active cashier for this development version.
        # Later, authentication will identify the actual logged-in cashier.
        cursor.execute("""
            SELECT id
            FROM users
            WHERE role = 'CASHIER'
              AND is_active = TRUE
            ORDER BY id
            LIMIT 1
        """)

        cashier = cursor.fetchone()

        if not cashier:
            connection.rollback()
            return jsonify({
                "success": False,
                "message": (
                    "No active cashier exists. "
                    "Create an active CASHIER user before checkout."
                )
            }), 400

        cashier_id = cashier["id"]

        # Lock the selected product rows to prevent concurrent
        # checkouts from selling the same remaining stock.
        product_ids = sorted(quantities.keys())
        placeholders = ", ".join(["%s"] * len(product_ids))

        cursor.execute(f"""
            SELECT id, name, sku, price, stock_quantity,
                   reorder_level, is_active
            FROM products
            WHERE id IN ({placeholders})
            ORDER BY id
            FOR UPDATE
        """, tuple(product_ids))

        rows = cursor.fetchall()
        products = {product["id"]: product for product in rows}

        if len(products) != len(product_ids):
            connection.rollback()
            return jsonify({
                "success": False,
                "message": "One or more products do not exist."
            }), 400

        # Recalculate prices and totals using database values.
        subtotal = Decimal("0.00")
        sale_items = []

        for product_id, quantity in quantities.items():
            product = products[product_id]

            if not product["is_active"]:
                connection.rollback()
                return jsonify({
                    "success": False,
                    "message": f"{product['name']} is inactive."
                }), 400

            if product["stock_quantity"] < quantity:
                connection.rollback()
                return jsonify({
                    "success": False,
                    "message": (
                        f"Insufficient stock for {product['name']}. "
                        f"Available: {product['stock_quantity']}."
                    )
                }), 400

            unit_price = money(product["price"])
            line_total = money(unit_price * quantity)
            subtotal += line_total

            sale_items.append({
                "product_id": product_id,
                "product_name": product["name"],
                "sku": product["sku"],
                "quantity": quantity,
                "unit_price": unit_price,
                "line_total": line_total
            })

        subtotal = money(subtotal)
        discount_amount = money(subtotal * discount_rate / 100)
        taxable_amount = money(subtotal - discount_amount)
        tax_amount = money(taxable_amount * tax_rate / 100)
        total = money(taxable_amount + tax_amount)

        # Generate a unique invoice number.
        invoice_number = (
            f"CB-{datetime.now().strftime('%Y%m%d%H%M%S')}-"
            f"{secrets.token_hex(3).upper()}"
        )

        # Create a completed cash sale.
        cursor.execute("""
            INSERT INTO sales (
                invoice_number,
                customer_id,
                cashier_id,
                subtotal,
                tax_amount,
                discount_amount,
                total_amount,
                payment_method,
                payment_status,
                sale_status
            )
            VALUES (
                %s, NULL, %s, %s, %s, %s, %s,
                'CASH', 'PAID', 'COMPLETED'
            )
        """, (
            invoice_number,
            cashier_id,
            subtotal,
            tax_amount,
            discount_amount,
            total
        ))
        sale_id = cursor.lastrowid

        # Save sale items, update inventory, and record stock movements.
        for item in sale_items:
            cursor.execute("""
                INSERT INTO sale_items (
                    sale_id,
                    product_id,
                    product_name,
                    sku,
                    quantity,
                    unit_price,
                    line_total
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                sale_id,
                item["product_id"],
                item["product_name"],
                item["sku"],
                item["quantity"],
                item["unit_price"],
                item["line_total"]
            ))

            product = products[item["product_id"]]
            new_stock = product["stock_quantity"] - item["quantity"]

            cursor.execute("""
                UPDATE products
                SET stock_quantity = %s
                WHERE id = %s
            """, (new_stock, item["product_id"]))

            cursor.execute("""
                INSERT INTO stock_movements (
                    product_id,
                    user_id,
                    sale_id,
                    movement_type,
                    quantity_change,
                    stock_after,
                    notes
                )
                VALUES (%s, %s, %s, 'SALE', %s, %s, %s)
            """, (
                item["product_id"],
                cashier_id,
                sale_id,
                -item["quantity"],
                new_stock,
                f"Sale invoice {invoice_number}"
            ))

            # Add a notification if stock reaches or falls below
            # the configured reorder level.
            if new_stock <= product["reorder_level"]:
                notification_type = (
                    "OUT_OF_STOCK" if new_stock == 0 else "LOW_STOCK"
                )

                cursor.execute("""
                    INSERT INTO notifications (
                        product_id,
                        notification_type,
                        message,
                        is_read
                    )
                    VALUES (%s, %s, %s, FALSE)
                """, (
                    item["product_id"],
                    notification_type,
                    (
                        f"{product['name']} stock is {new_stock}. "
                        f"Reorder level: {product['reorder_level']}."
                    )
                ))

        # Save all changes together.
        connection.commit()

        return jsonify({
            "success": True,
            "message": "Checkout completed successfully.",
            "sale_id": sale_id,
            "invoice_number": invoice_number,
            "subtotal": float(subtotal),
            "discount": float(discount_amount),
            "tax": float(tax_amount),
            "total": float(total),
            "payment_method": "CASH",
            "payment_status": "PAID",
            "items": [
                {
                    "product_id": item["product_id"],
                    "product_name": item["product_name"],
                    "quantity": item["quantity"],
                    "line_total": float(item["line_total"])
                }
                for item in sale_items
            ]
        }), 201

    except Exception:
        if connection:
            connection.rollback()

        # Log the actual error in the backend console.
        import logging
        logging.exception("Checkout failed")

        return jsonify({
            "success": False,
            "message": "Checkout failed. Please check the backend console."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()