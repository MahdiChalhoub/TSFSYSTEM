from django.db import connection

def apply_missing_columns():
    with connection.cursor() as cursor:
        # 1. Check brand.logo
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'brand' AND column_name = 'logo'")
        if not cursor.fetchone():
            print("Adding brand.logo...")
            cursor.execute("ALTER TABLE brand ADD COLUMN logo varchar(255)")
        else:
            print("brand.logo already exists.")

        # 2. Check product.size
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'product' AND column_name = 'size'")
        if not cursor.fetchone():
            print("Adding product.size...")
            cursor.execute("ALTER TABLE product ADD COLUMN size decimal(10,2)")
        else:
            print("product.size already exists.")

        # 3. Check product.size_unit_id
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'product' AND column_name = 'size_unit_id'")
        if not cursor.fetchone():
            print("Adding product.size_unit_id...")
            cursor.execute("ALTER TABLE product ADD COLUMN size_unit_id integer REFERENCES unit(id) ON DELETE SET NULL")
        else:
            print("product.size_unit_id already exists.")

        # 4. Check brand_countries M2M table
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_name = 'brand_countries'")
        if not cursor.fetchone():
            print("Creating brand_countries table...")
            cursor.execute("""
                CREATE TABLE brand_countries (
                    id SERIAL PRIMARY KEY,
                    brand_id integer NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
                    country_id integer NOT NULL REFERENCES country(id) ON DELETE CASCADE
                )
            """)
            cursor.execute("CREATE UNIQUE INDEX brand_countries_brand_id_country_id_key ON brand_countries (brand_id, country_id)")
        else:
            print("brand_countries table already exists.")

    print("✅ Schema check/apply complete!")

if __name__ == "__main__":
    apply_missing_columns()
