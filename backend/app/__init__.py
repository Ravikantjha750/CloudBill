from flask import Flask, jsonify
from flask_cors import CORS
from app.config import Config
from app.routes.products import products_bp
from app.routes.sales import sales_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(
        app,
        resources={
            r"/api/*": {"origins": "http://localhost:5173"}
        }
    )

    # Register product management endpoints
    app.register_blueprint(products_bp)
    app.register_blueprint(sales_bp)

    @app.get("/api/health")
    def health():
        return jsonify({
            "status": "success",
            "message": "Cloud Retail Billing API is running"
        }), 200

    @app.get("/api/health/db")
    def database_health():
        from app.db import get_db_connection

        connection = None

        try:
            connection = get_db_connection()

            with connection.cursor() as cursor:
                cursor.execute("SELECT VERSION() AS version")
                result = cursor.fetchone()

            return jsonify({
                "status": "success",
                "message": "MySQL connection successful",
                "mysql_version": result["version"]
            }), 200

        except Exception:
            app.logger.exception("Database health check failed")

            return jsonify({
                "status": "error",
                "message": "Could not connect to the database"
            }), 500

        finally:
            if connection is not None:
                connection.close()

    return app