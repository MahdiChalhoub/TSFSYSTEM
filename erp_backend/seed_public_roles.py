from erp.models import Organization, Role
import uuid

def seed_public_roles(slug):
    try:
        org = Organization.objects.get(slug=slug)
        roles_data = [
            ('Salesperson', 'Register sales and manage basic inventory'),
            ('Cashier', 'Handle payments and cash register'),
            ('Inventory Manager', 'Manage products and stock movements'),
            ('Delivery Driver', 'Handle outbound orders and tracking'),
        ]
        
        for name, desc in roles_data:
            role, created = Role.objects.update_or_create(
                organization=org,
                name=name,
                defaults={
                    'description': desc,
                    'is_public_requestable': True
                }
            )
            print(f"Role '{name}' {'created' if created else 'updated'} as public for {org.slug}")
    except Organization.DoesNotExist:
        print(f"Organization with slug '{slug}' not found.")

if __name__ == "__main__":
    seed_public_roles('tsf')
