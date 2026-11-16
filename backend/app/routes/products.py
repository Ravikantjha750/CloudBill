from flask import Blueprint, request, jsonify
from app.db import get_db_connection

products_bp = Blueprint(
    "products",
    __name__,
    url_prefix="/api/products"
)

@products_bp.get("")
def get_products():
    connection = None
    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    p.id,
                    p.name,
                    p.sku,
                    p.description,
                    p.price,
                    p.stock_quantity,
                    p.reorder_level,
                    p.category_id,
                    c.name AS category_name,
                    p.is_active
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                ORDER BY p.id DESC
            """)

            products = cursor.fetchall()

        return jsonify({
            "status": "success",
            "products": products
        }), 200

    except Exception:
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve products"
        }), 500

    finally:
        if connection is not None:
            connection.close()


@products_bp.post("")
def create_product():
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    sku = data.get("sku")
    price = data.get("price")
    stock_quantity = data.get("stock_quantity", 0)
    reorder_level = data.get("reorder_level", 5)
    description = data.get("description")
    category_id = data.get("category_id")

    if not isinstance(name, str) or not name.strip():
        return jsonify({
            "status": "error",
            "message": "Product name is required"
        }), 400

    if not isinstance(sku, str) or not sku.strip():
        return jsonify({
            "status": "error",
            "message": "Product SKU is required"
        }), 400

    try:
        if isinstance(price, bool):
            raise ValueError

        price = float(price)

        if price < 0:
            raise ValueError

        if not isinstance(stock_quantity, int) or isinstance(stock_quantity, bool):
            raise ValueError

        if not isinstance(reorder_level, int) or isinstance(reorder_level, bool):
            raise ValueError

        if stock_quantity < 0 or reorder_level < 0:
            raise ValueError

        if category_id is not None:
            if not isinstance(category_id, int) or isinstance(category_id, bool):
                raise ValueError

    except (TypeError, ValueError):
        return jsonify({
            "status": "error",
            "message": "Price, stock quantity, reorder level, or category ID is invalid"
        }), 400

    connection = None

    try:
        connection = get_db_connection()

        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO products (
                    name,
                    sku,
                    description,
                    price,
                    stock_quantity,
                    reorder_level,
                    category_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                name.strip(),
                sku.strip(),
                description,
                price,
                stock_quantity,
                reorder_level,
                category_id
            ))

            product_id = cursor.lastrowid

            if stock_quantity > 0:
                cursor.execute("""
                    INSERT INTO stock_movements (
                        product_id,
                        movement_type,
                        quantity_change,
                        stock_after,
                        notes
                    )
                    VALUES (%s, 'OPENING', %s, %s, %s)
                """, (
                    product_id,
                    stock_quantity,
                    stock_quantity,
                    "Initial stock"
                ))

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Product created successfully",
            "product_id": product_id
        }), 201

    except Exception as exc:
        if connection is not None:
            connection.rollback()

        if getattr(exc, "args", [None])[0] == 1062:
            return jsonify({
                "status": "error",
                "message": "This SKU already exists"
            }), 409

        return jsonify({
            "status": "error",
            "message": "Unable to create product"
        }), 500

    finally:
        if connection is not None:
            connection.close()