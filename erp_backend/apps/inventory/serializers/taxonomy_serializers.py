from rest_framework import serializers
from apps.inventory.models import (
    Unit, UnitPackage, PackagingSuggestionRule,
    Category, Brand, Parfum, Product, ProductGroup, ProductAttribute,
)
from erp.models import Country

# NOTE: Reverse-related managers (obj.products, obj.brands, etc.) bypass the
# TenantManager and leak cross-organization data. All get_*_count methods
# below explicitly use Product.objects.filter(...) (tenant-scoped) instead
# of obj.products.count() to ensure counts match /explore/ results.


class UnitSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    package_count = serializers.SerializerMethodField()

    class Meta:
        model = Unit
        fields = [
            'id', 'code', 'name', 'short_name', 'type',
            'conversion_factor', 'base_unit', 'allow_fraction',
            'needs_balance', 'balance_code_structure', 'product_count',
            'package_count', 'organization'
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return Product.objects.filter(unit=obj).count()

    def get_package_count(self, obj):
        return UnitPackage.objects.filter(unit=obj).count()


class CountrySimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['id', 'code', 'name']


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    brand_count = serializers.SerializerMethodField()
    parfum_count = serializers.SerializerMethodField()
    attribute_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'name_fr', 'name_ar', 'translations',
            'code', 'short_name', 'parent',
            'level', 'full_path', 'product_count',
            'brand_count', 'parfum_count', 'attribute_count', 'organization',
            'is_archived', 'archived_at',
            'barcode_prefix',
        ]
        read_only_fields = ['organization', 'level', 'full_path', 'archived_at']

    def validate_name(self, value):
        """Pre-flight duplicate check so the DB UNIQUE constraint doesn't
        bubble up as a 500. DRF turns ValidationError into 400 with a clean
        field-level message the frontend can render."""
        from erp.middleware import get_current_tenant_id
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return value
        qs = Category.original_objects.filter(name__iexact=value, organization_id=tenant_id)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f'A category named "{value}" already exists. Pick a different name or edit the existing one.'
            )
        return value

    def validate_barcode_prefix(self, value):
        """Barcode prefixes must be unique per tenant (non-empty only).
        Two categories sharing a prefix would collide on auto-generated
        product barcodes. Empty string is allowed and means "no prefix"."""
        if not value:
            return value
        from erp.middleware import get_current_tenant_id
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return value
        qs = Category.original_objects.filter(
            barcode_prefix=value, organization_id=tenant_id,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            owner = qs.first().name
            raise serializers.ValidationError(
                f'Prefix "{value}" is already used by category "{owner}". '
                f'Each category needs its own unique prefix — otherwise barcodes collide.'
            )
        return value

    def get_product_count(self, obj):
        pre = (self.context or {}).get('product_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        return Product.objects.filter(category=obj).count()

    # ── Union counts (auto-linked via products + explicit M2M) ────────────
    # `linked_brands` / `linked_attributes` / `with_counts` all compute the
    # union of "products in this category reference this brand/attribute"
    # (auto) and "category was explicitly pre-registered with this
    # brand/attribute" (explicit M2M). Every Category serialisation must
    # report the same number, otherwise row badges and detail-tab counts
    # diverge. The single source of truth lives here.
    #
    # When serializing many categories at once, pass
    # `context={'brand_counts':..., 'parfum_counts':..., 'attribute_counts':..., 'product_counts':...}`
    # to avoid N+1 (see `CategorySerializer.prefetch_counts`).

    def get_brand_count(self, obj):
        pre = (self.context or {}).get('brand_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        auto = set(
            Product.objects.filter(category=obj, brand__isnull=False)
                .values_list('brand_id', flat=True).distinct()
        )
        explicit = set(
            Brand.categories.through.objects
                .filter(category_id=obj.id)
                .values_list('brand_id', flat=True)
        )
        return len(auto | explicit)

    def get_parfum_count(self, obj):
        pre = (self.context or {}).get('parfum_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        auto = set(
            Product.objects.filter(category=obj, parfum__isnull=False)
                .values_list('parfum_id', flat=True).distinct()
        )
        explicit = set(
            Parfum.categories.through.objects
                .filter(category_id=obj.id)
                .values_list('parfum_id', flat=True)
        )
        return len(auto | explicit)

    def get_attribute_count(self, obj):
        pre = (self.context or {}).get('attribute_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        # Auto-derived: attribute groups whose leaf values are referenced
        # by a product in this category (leaf.parent → group).
        auto = set(
            Product.attribute_values.through.objects
                .filter(
                    product__category_id=obj.id,
                    productattribute__parent_id__isnull=False,
                )
                .values_list('productattribute__parent_id', flat=True)
        )
        # Explicit: category.attributes M2M (pre-registration, root groups only).
        explicit = set(
            ProductAttribute.categories.through.objects
                .filter(
                    category_id=obj.id,
                    productattribute__parent__isnull=True,
                )
                .values_list('productattribute_id', flat=True)
        )
        return len(auto | explicit)

    @classmethod
    def prefetch_counts(cls, organization):
        """Bulk-compute product/brand/parfum/attribute counts for every
        category in one tenant. Returns a context dict to pass to the
        serializer — eliminates N+1 when rendering many categories.

        Union = products-in-category (auto) ∪ pre-registered M2M (explicit).
        """
        product_counts: dict[int, int] = {}
        auto_brands: dict[int, set[int]] = {}
        auto_parfums: dict[int, set[int]] = {}
        auto_attrs: dict[int, set[int]] = {}

        # Products in this tenant grouped by category
        for p in Product.objects.filter(
            organization=organization, category__isnull=False
        ).values('category_id', 'brand_id', 'parfum_id'):
            cid = p['category_id']
            product_counts[cid] = product_counts.get(cid, 0) + 1
            if p['brand_id']:
                auto_brands.setdefault(cid, set()).add(p['brand_id'])
            if p['parfum_id']:
                auto_parfums.setdefault(cid, set()).add(p['parfum_id'])

        # Auto attributes: one pass over the product↔attribute_values through
        # table, grouped on the leaf's parent (the attribute group).
        for cid, gid in Product.attribute_values.through.objects.filter(
            product__organization=organization,
            product__category__isnull=False,
            productattribute__parent_id__isnull=False,
        ).values_list('product__category_id', 'productattribute__parent_id'):
            if gid is not None:
                auto_attrs.setdefault(cid, set()).add(gid)

        # Explicit M2M links per category
        explicit_brands: dict[int, set[int]] = {}
        for bid, cid in Brand.categories.through.objects.filter(
            category__organization=organization,
        ).values_list('brand_id', 'category_id'):
            explicit_brands.setdefault(cid, set()).add(bid)

        explicit_parfums: dict[int, set[int]] = {}
        for pid, cid in Parfum.categories.through.objects.filter(
            category__organization=organization,
        ).values_list('parfum_id', 'category_id'):
            explicit_parfums.setdefault(cid, set()).add(pid)

        explicit_attrs: dict[int, set[int]] = {}
        for aid, cid in ProductAttribute.categories.through.objects.filter(
            productattribute__organization=organization,
            productattribute__parent__isnull=True,
        ).values_list('productattribute_id', 'category_id'):
            explicit_attrs.setdefault(cid, set()).add(aid)

        brand_counts = {
            cid: len(auto_brands.get(cid, set()) | explicit_brands.get(cid, set()))
            for cid in set(auto_brands) | set(explicit_brands)
        }
        parfum_counts = {
            cid: len(auto_parfums.get(cid, set()) | explicit_parfums.get(cid, set()))
            for cid in set(auto_parfums) | set(explicit_parfums)
        }
        attribute_counts = {
            cid: len(auto_attrs.get(cid, set()) | explicit_attrs.get(cid, set()))
            for cid in set(auto_attrs) | set(explicit_attrs)
        }

        return {
            'product_counts': product_counts,
            'brand_counts': brand_counts,
            'parfum_counts': parfum_counts,
            'attribute_counts': attribute_counts,
        }


class CategorySimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'code']


class AttributeSimpleSerializer(serializers.ModelSerializer):
    """Lightweight read shape for embedding in BrandSerializer.attributes —
    a brand links to attribute *root groups* (Size, Color, Parfum), so the
    parent_id is exposed for clients that want to skip leaves on display."""
    class Meta:
        model = ProductAttribute
        fields = ['id', 'name', 'code', 'parent']


class StorefrontCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'code', 'short_name', 'full_path', 'level', 'products_count']


class BrandSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    # Counts are the UNION of M2M-linked entries and product-derived
    # entries, plus a Universal/Uncategorized/No-attributes bucket when
    # at least one product has the FK unset. Mirrors the in-tree facet
    # group counts the user sees on /inventory/brands.
    category_count = serializers.SerializerMethodField()
    country_count = serializers.SerializerMethodField()
    attribute_count = serializers.SerializerMethodField()
    countries = CountrySimpleSerializer(many=True, read_only=True)
    categories = CategorySimpleSerializer(many=True, read_only=True)
    attributes = AttributeSimpleSerializer(many=True, read_only=True)
    category_ids = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), many=True, write_only=True, source='categories', required=False
    )
    country_ids = serializers.PrimaryKeyRelatedField(
        queryset=Country.objects.all(), many=True, write_only=True, source='countries', required=False
    )
    attribute_ids = serializers.PrimaryKeyRelatedField(
        queryset=ProductAttribute.objects.all(), many=True, write_only=True, source='attributes', required=False
    )

    class Meta:
        # `short_name` — readable marketing abbreviation (e.g. "P&G")
        # `code`       — short ISO-like identifier (e.g. "PNG"); separate
        #                from short_name, mirrors the Category split
        model = Brand
        fields = [
            'id', 'name', 'reference_code', 'short_name', 'code', 'logo', 'translations',
            'countries', 'categories', 'attributes',
            'category_ids', 'country_ids', 'attribute_ids',
            'product_count', 'category_count', 'country_count', 'attribute_count',
            'created_at', 'organization',
        ]
        read_only_fields = ['organization', 'reference_code']

    def get_product_count(self, obj):
        pre = (self.context or {}).get('product_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        return Product.objects.filter(brand=obj).count()

    def get_category_count(self, obj):
        pre = (self.context or {}).get('category_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        m2m_ids = set(obj.categories.values_list('id', flat=True))
        product_ids = set(
            obj.products.exclude(category__isnull=True).values_list('category', flat=True)
        )
        union_ids = m2m_ids | product_ids
        has_uncategorized = obj.products.filter(category__isnull=True).exists()
        return len(union_ids) + (1 if has_uncategorized else 0)

    def get_country_count(self, obj):
        pre = (self.context or {}).get('country_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        m2m_ids = set(obj.countries.values_list('id', flat=True))
        product_ids = set(
            obj.products.exclude(country__isnull=True).values_list('country', flat=True)
        )
        union_ids = m2m_ids | product_ids
        has_universal = obj.products.filter(country__isnull=True).exists() if obj.products.exists() else False
        return len(union_ids) + (1 if has_universal else 0)

    def get_attribute_count(self, obj):
        pre = (self.context or {}).get('attribute_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        # Union of (1) Brand.attributes M2M and (2) every distinct
        # ProductAttribute leaf any of the brand's products references
        # via Product.attribute_values. Plus a "No attributes" +1
        # bucket when any product carries zero attribute_values.
        # Mirrors the bulk prefetch_counts formula exactly so the
        # cached and uncached paths agree on every brand.
        m2m_ids = set(obj.attributes.values_list('id', flat=True))
        from apps.inventory.models import ProductAttribute
        product_ids = set(
            ProductAttribute.objects
                .filter(products_with_attribute__brand=obj)
                .values_list('id', flat=True)
                .distinct()
        )
        union_ids = m2m_ids | product_ids
        has_unattributed = obj.products.filter(attribute_values__isnull=True).exists()
        return len(union_ids) + (1 if has_unattributed else 0)

    @classmethod
    def prefetch_counts(cls, organization):
        """Bulk-calculate the four chip counts for every brand in the
        organization. Returns a dict of dicts:

            {
              'product_counts':   {brand_id: int, ...},
              'category_counts':  {brand_id: int, ...},
              'country_counts':   {brand_id: int, ...},
              'attribute_counts': {brand_id: int, ...},
            }

        Computing all four here avoids the N+1 storm where each
        SerializerMethodField would otherwise hit the DB once per
        brand on every list call (and the brands page sets
        cache: 'no-store', so this list call runs on every page hit).

        Each *_count value matches the per-brand union-and-bucket
        formula used by the matching getter — see those getters for
        the semantics.
        """
        from django.db.models import Count, Q
        from apps.inventory.models import Product, Brand

        scope = Product.objects.filter(organization=organization)

        # All counts are pushed into the database as GROUP BY queries.
        # The earlier implementation pulled every (brand_id, fk_id)
        # tuple back to Python and looped — fine at 1k products,
        # painful at 100k. Here each query returns at most one row
        # per brand (~hundreds, not 100k), regardless of catalogue
        # size, so wall-time stays roughly flat as products grow.

        # Product count + per-brand "has a product with NULL category /
        # country" flags. Single GROUP BY against the products table,
        # no JOINs — the FKs live on Product itself so we don't trigger
        # row-multiplying joins. The unattributed-brand check goes in a
        # separate query below because it walks the M2M through-table
        # and combining it here would explode the row count (one row
        # per product × attribute_value pair, inflating Count('id')).
        product_rows = list(
            scope.exclude(brand_id__isnull=True)
                 .values('brand_id')
                 .annotate(
                     n_products=Count('id'),
                     n_null_cat=Count('id', filter=Q(category__isnull=True)),
                     n_null_country=Count('id', filter=Q(country__isnull=True)),
                 )
        )
        product_counts: dict[int, int] = {r['brand_id']: r['n_products'] for r in product_rows}
        cat_has_null: set[int] = {r['brand_id'] for r in product_rows if r['n_null_cat']}
        country_has_null: set[int] = {r['brand_id'] for r in product_rows if r['n_null_country']}

        # Brands with at least one product that carries zero attribute
        # values. Separate query — the M2M join inflates row counts,
        # so it can't share the GROUP BY above.
        unattr_brands: set[int] = set(
            scope.filter(attribute_values__isnull=True)
                 .exclude(brand_id__isnull=True)
                 .values_list('brand_id', flat=True)
                 .distinct()
        )

        # Distinct categories / countries / attributes per brand —
        # SQL Count(distinct=True) does the dedupe inside Postgres.
        # One GROUP BY each, no per-row Python work.
        cat_distinct_rows = (
            scope.exclude(brand_id__isnull=True).exclude(category__isnull=True)
                 .values('brand_id')
                 .annotate(n=Count('category', distinct=True))
        )
        cat_distinct: dict[int, int] = {r['brand_id']: r['n'] for r in cat_distinct_rows}

        country_distinct_rows = (
            scope.exclude(brand_id__isnull=True).exclude(country__isnull=True)
                 .values('brand_id')
                 .annotate(n=Count('country', distinct=True))
        )
        country_distinct: dict[int, int] = {r['brand_id']: r['n'] for r in country_distinct_rows}

        attr_distinct_rows = (
            scope.exclude(brand_id__isnull=True)
                 .values('brand_id')
                 .annotate(n=Count('attribute_values', distinct=True))
        )
        attr_distinct: dict[int, int] = {r['brand_id']: r['n'] for r in attr_distinct_rows}

        # M2M-side counts: through-tables are tiny (one row per link)
        # so this stays cheap regardless of product count. We need
        # distinct over the UNION of M2M-linked and product-derived,
        # but a brand rarely has many M2M-only categories outside what
        # its products use, so we approximate the union by summing
        # (M2M_distinct - intersection_with_product_set) + product_distinct.
        # To keep this tractable in pure SQL, fall back to fetching the
        # ids of the M2M side only (typically 1-10 per brand) and
        # XOR-merging in Python.
        cat_m2m_rows = (
            Brand.categories.through.objects
                .filter(brand__organization=organization)
                .values_list('brand_id', 'category_id')
        )
        country_m2m_rows = (
            Brand.countries.through.objects
                .filter(brand__organization=organization)
                .values_list('brand_id', 'country_id')
        )
        attr_m2m_rows = (
            Brand.attributes.through.objects
                .filter(brand__organization=organization)
                .values_list('brand_id', 'productattribute_id')
        )

        # For the union we need to know which product-side fk ids are
        # already covered. Fetch the unique pairs (1 row per
        # (brand, fk) — orders of magnitude smaller than products).
        cat_pair_rows = (
            scope.exclude(brand_id__isnull=True).exclude(category__isnull=True)
                 .values_list('brand_id', 'category').distinct()
        )
        country_pair_rows = (
            scope.exclude(brand_id__isnull=True).exclude(country__isnull=True)
                 .values_list('brand_id', 'country').distinct()
        )
        attr_pair_rows = (
            scope.exclude(brand_id__isnull=True)
                 .exclude(attribute_values__isnull=True)
                 .values_list('brand_id', 'attribute_values').distinct()
        )

        def union_count(
            distinct_per_brand: dict[int, int],
            m2m_rows,
            pair_rows,
        ) -> dict[int, int]:
            # Count m2m ids that aren't already in the product-derived
            # set for that brand. distinct_per_brand already has the
            # product-side count; we just add the M2M-only ids.
            covered: dict[int, set] = {}
            for b, fk in pair_rows:
                covered.setdefault(b, set()).add(fk)
            extra: dict[int, int] = {}
            for b, fk in m2m_rows:
                if b in covered and fk in covered[b]:
                    continue
                extra[b] = extra.get(b, 0) + 1
                covered.setdefault(b, set()).add(fk)
            out = dict(distinct_per_brand)
            for b, n in extra.items():
                out[b] = out.get(b, 0) + n
            return out

        cat_union   = union_count(cat_distinct,     cat_m2m_rows,     cat_pair_rows)
        country_union = union_count(country_distinct, country_m2m_rows, country_pair_rows)
        attr_union  = union_count(attr_distinct,    attr_m2m_rows,    attr_pair_rows)

        # Apply the +1 "Universal / Uncategorized / No-attributes"
        # bucket per the user-visible facet semantics.
        category_counts: dict[int, int] = {b: n + (1 if b in cat_has_null else 0) for b, n in cat_union.items()}
        for b in cat_has_null:
            category_counts.setdefault(b, 1)

        country_counts: dict[int, int] = {b: n + (1 if b in country_has_null else 0) for b, n in country_union.items()}
        for b in country_has_null:
            country_counts.setdefault(b, 1)

        attribute_counts: dict[int, int] = {b: n + (1 if b in unattr_brands else 0) for b, n in attr_union.items()}
        for b in unattr_brands:
            attribute_counts.setdefault(b, 1)

        return {
            'product_counts':   product_counts,
            'category_counts':  category_counts,
            'country_counts':   country_counts,
            'attribute_counts': attribute_counts,
        }


class BrandDetailSerializer(serializers.ModelSerializer):
    """Detail (retrieve) serializer — must match the list serializer's
    shape because the brand edit modal refetches via this endpoint to
    get fresh M2M state after in-tab Link/Unlink actions. Adding fields
    that BrandSerializer exposes (translations, reference_code, nested
    categories, write-only category_ids/country_ids) avoids the modal
    seeing two different shapes from list vs retrieve.
    """
    countries = CountrySimpleSerializer(many=True, read_only=True)
    categories = CategorySimpleSerializer(many=True, read_only=True)
    attributes = AttributeSimpleSerializer(many=True, read_only=True)
    category_ids = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), many=True, write_only=True, source='categories', required=False
    )
    country_ids = serializers.PrimaryKeyRelatedField(
        queryset=Country.objects.all(), many=True, write_only=True, source='countries', required=False
    )
    attribute_ids = serializers.PrimaryKeyRelatedField(
        queryset=ProductAttribute.objects.all(), many=True, write_only=True, source='attributes', required=False
    )
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            'id', 'name', 'reference_code', 'short_name', 'code', 'logo', 'translations',
            'countries', 'categories', 'attributes',
            'category_ids', 'country_ids', 'attribute_ids',
            'product_count', 'created_at', 'organization',
        ]
        read_only_fields = ['organization', 'reference_code']

    def get_product_count(self, obj):
        return Product.objects.filter(brand=obj).count()


class StorefrontBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['id', 'name', 'short_name', 'logo']


class ParfumSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    categories = CategorySimpleSerializer(many=True, read_only=True)
    category_ids = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), many=True, write_only=True, source='categories', required=False
    )

    class Meta:
        model = Parfum
        fields = [
            'id', 'name', 'reference_code', 'short_name', 'translations',
            'categories', 'category_ids',
            'product_count',
            'organization',
        ]
        read_only_fields = ['organization', 'reference_code']

    def get_product_count(self, obj):
        return Product.objects.filter(parfum=obj).count()


class ProductGroupSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)
    parfum_name = serializers.CharField(source='parfum.name', read_only=True, default=None)
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = ProductGroup
        fields = [
            'id', 'name', 'description', 'image',
            'brand', 'parfum', 'category',
            'brand_name', 'parfum_name', 'category_name',
            'product_count', 'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return Product.objects.filter(product_group=obj).count()


class UnitPackageSerializer(serializers.ModelSerializer):
    unit_name = serializers.ReadOnlyField(source='unit.name')
    unit_code = serializers.ReadOnlyField(source='unit.code')
    unit_type = serializers.ReadOnlyField(source='unit.type')

    parent_name = serializers.ReadOnlyField(source='parent.name', default=None)
    parent_ratio = serializers.DecimalField(
        max_digits=15, decimal_places=4, allow_null=True, required=False,
    )

    class Meta:
        model = UnitPackage
        fields = [
            'id', 'unit', 'unit_name', 'unit_code', 'unit_type',
            'parent', 'parent_name', 'parent_ratio',
            'name', 'code', 'ratio', 'is_default', 'order', 'notes',
            'is_archived', 'archived_at',
            'created_at', 'updated_at', 'organization',
        ]
        read_only_fields = ['organization', 'created_at', 'updated_at', 'archived_at']

    def validate(self, attrs):
        """Chain integrity: tenant scope, same-unit, cycle detection,
        parent_ratio sanity, and server-derived `ratio` when chained.

        Object-level validation because `parent` must be cross-checked
        against `unit` and `ratio` is recomputed from the chain.
        """
        from erp.middleware import get_current_tenant_id
        from decimal import Decimal

        instance = self.instance
        unit = attrs.get('unit') or (instance.unit if instance else None)
        parent = attrs.get('parent') if 'parent' in attrs else (instance.parent if instance else None)
        parent_ratio = attrs.get('parent_ratio') if 'parent_ratio' in attrs else (instance.parent_ratio if instance else None)

        if parent is not None:
            tenant_id = get_current_tenant_id()
            if tenant_id and parent.organization_id != tenant_id:
                raise serializers.ValidationError({
                    'parent': 'Parent template belongs to a different organization.'
                })
            if unit and parent.unit_id != unit.id:
                raise serializers.ValidationError({
                    'parent': (
                        f'Parent template "{parent.name}" uses a different unit '
                        f'({parent.unit.code}) — chains must stay within one unit family.'
                    )
                })
            # Cycle detection — walk up from parent
            seen = set()
            cursor = parent
            while cursor is not None:
                if instance and cursor.id == instance.id:
                    raise serializers.ValidationError({
                        'parent': 'Cycle detected — a template cannot be its own ancestor.'
                    })
                if cursor.id in seen:
                    raise serializers.ValidationError({
                        'parent': 'Existing chain already contains a cycle — repair required.'
                    })
                seen.add(cursor.id)
                cursor = cursor.parent
            if parent_ratio is None or Decimal(str(parent_ratio)) <= 0:
                raise serializers.ValidationError({
                    'parent_ratio': 'When a parent is set, parent_ratio is required and must be > 0.'
                })
            # Derive `ratio` server-side — ignore any client value for consistency
            attrs['ratio'] = (Decimal(str(parent.ratio)) * Decimal(str(parent_ratio))).quantize(Decimal('0.0001'))
        else:
            # Base-level template — clear parent_ratio to avoid orphan data
            attrs['parent_ratio'] = None

        return attrs


class PackagingSuggestionRuleSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    brand_name = serializers.ReadOnlyField(source='brand.name')
    attribute_name = serializers.ReadOnlyField(source='attribute.name')
    packaging_name = serializers.ReadOnlyField(source='packaging.name')
    packaging_ratio = serializers.ReadOnlyField(source='packaging.ratio')
    packaging_unit_code = serializers.ReadOnlyField(source='packaging.unit.code')
    specificity = serializers.ReadOnlyField()
    effective_priority = serializers.SerializerMethodField()

    class Meta:
        model = PackagingSuggestionRule
        fields = [
            'id', 'category', 'category_name', 'brand', 'brand_name',
            'attribute', 'attribute_name', 'attribute_value',
            'packaging', 'packaging_name', 'packaging_ratio', 'packaging_unit_code',
            'priority', 'effective_priority', 'specificity',
            'usage_count', 'notes',
            'created_at', 'updated_at', 'organization',
        ]
        read_only_fields = ['organization', 'usage_count', 'created_at', 'updated_at']

    def get_effective_priority(self, obj):
        return obj.effective_priority()
