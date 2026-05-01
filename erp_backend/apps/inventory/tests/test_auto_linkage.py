from django.test import TestCase
from erp.models import Organization
# Pattern D: test-fixture import at module-collection time pre-empts the connector
# (no org context yet, OrganizationModule check would mark reference DISABLED).
from apps.reference.models import Country  # noqa: E402  (Pattern D: test fixture)
from apps.inventory.models import Product, Brand, Category, ProductAttribute

class TestProductAutoLinkage(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name='Test Org')
        # Create a few countries
        cls.lebanon = Country.objects.create(name='Lebanon', iso2='LB', iso3='LBN', numeric_code='422')
        cls.france = Country.objects.create(name='France', iso2='FR', iso3='FRA', numeric_code='250')
        
        cls.brand = Brand.objects.create(organization=cls.org, name='Test Brand')
        cls.category = Category.objects.create(organization=cls.org, name='Test Category')
        
        # Attribute Group (Parent)
        cls.attr_group = ProductAttribute.objects.create(
            organization=cls.org, name='Size', parent=None
        )
        # Attribute Value (Child)
        cls.attr_value = ProductAttribute.objects.create(
            organization=cls.org, name='100ml', parent=cls.attr_group
        )

    def test_auto_linkage_on_product_create(self):
        """Verifies that Brand is linked to Country and Category on product creation."""
        Product.objects.create(
            organization=self.org,
            sku='P1',
            name='Product 1',
            brand=self.brand,
            category=self.category,
            country_of_origin=self.lebanon
        )
        
        # Check Brand - Country link
        self.assertTrue(self.brand.origin_countries.filter(id=self.lebanon.id).exists())
        
        # Check Brand - Category link
        self.assertTrue(self.brand.categories.filter(id=self.category.id).exists())

    def test_auto_linkage_on_attribute_add(self):
        """Verifies that Attribute Group is linked to Brand and Category when added to a product."""
        product = Product.objects.create(
            organization=self.org,
            sku='P2',
            name='Product 2',
            brand=self.brand,
            category=self.category
        )
        
        # Add attribute value (triggers m2m_changed)
        product.attribute_values.add(self.attr_value)
        
        # Check Brand - Attribute Group link
        self.assertTrue(self.brand.attributes.filter(id=self.attr_group.id).exists())
        
        # Check Category - Attribute Group link
        self.assertTrue(self.category.attributes.filter(id=self.attr_group.id).exists())

    def test_auto_linkage_on_product_update(self):
        """Verifies that updating a product's origin country links it to the brand."""
        product = Product.objects.create(
            organization=self.org,
            sku='P3',
            name='Product 3',
            brand=self.brand,
            category=self.category
        )
        
        # Update country
        product.country_of_origin = self.france
        product.save()
        
        # Check Brand - Country link
        self.assertTrue(self.brand.origin_countries.filter(id=self.france.id).exists())

    def test_multiple_attributes_linkage(self):
        """Verifies that multiple attribute groups are linked correctly."""
        fragrance_group = ProductAttribute.objects.create(
            organization=self.org, name='Fragrance', parent=None
        )
        floral_val = ProductAttribute.objects.create(
            organization=self.org, name='Floral', parent=fragrance_group
        )
        
        product = Product.objects.create(
            organization=self.org,
            sku='P4',
            name='Product 4',
            brand=self.brand,
            category=self.category
        )
        
        product.attribute_values.add(self.attr_value, floral_val)
        
        # Verify both groups are linked
        brand_attrs = self.brand.attributes.values_list('id', flat=True)
        self.assertIn(self.attr_group.id, brand_attrs)
        self.assertIn(fragrance_group.id, brand_attrs)
        
        cat_attrs = self.category.attributes.values_list('id', flat=True)
        self.assertIn(self.attr_group.id, cat_attrs)
        self.assertIn(fragrance_group.id, cat_attrs)
