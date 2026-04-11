"""
Seed demo suppliers and clients for Purchase Order testing.
Usage: python manage.py seed_contacts
"""
from django.core.management.base import BaseCommand
from apps.crm.models import Contact


SUPPLIERS = [
    {"name": "Unilever Distribution CI",   "phone": "+225 27 20 30 40 50", "email": "orders@unilever-ci.com",   "company_name": "Unilever Côte d'Ivoire",     "entity_type": "BUSINESS", "supplier_category": "REGULAR",     "country_code": "CI"},
    {"name": "Nestlé Afrique de l'Ouest",  "phone": "+225 27 20 31 41 51", "email": "supply@nestle-ao.com",     "company_name": "Nestlé AO",                  "entity_type": "BUSINESS", "supplier_category": "REGULAR",     "country_code": "CI"},
    {"name": "Procter & Gamble CI",        "phone": "+225 27 20 32 42 52", "email": "pg-ci@pg.com",             "company_name": "P&G Côte d'Ivoire",           "entity_type": "BUSINESS", "supplier_category": "REGULAR",     "country_code": "CI"},
    {"name": "Brassivoire (HEINEKEN)",     "phone": "+225 27 20 33 43 53", "email": "distri@brassivoire.ci",    "company_name": "Brassivoire SA",              "entity_type": "BUSINESS", "supplier_category": "REGULAR",     "country_code": "CI"},
    {"name": "SIFCA Group",                "phone": "+225 27 20 34 44 54", "email": "ventes@sifca-group.com",   "company_name": "SIFCA Group SA",              "entity_type": "BUSINESS", "supplier_category": "REGULAR",     "country_code": "CI"},
    {"name": "Cemoi Chocolat",             "phone": "+225 27 20 35 45 55", "email": "export@cemoi.ci",          "company_name": "Cemoi CI",                    "entity_type": "BUSINESS", "supplier_category": "REGULAR",     "country_code": "CI"},
    {"name": "Mamadou Traoré (Grossiste)", "phone": "+225 07 08 09 10 11", "email": "mamadou.t@gmail.com",      "company_name": None,                          "entity_type": "INDIVIDUAL", "supplier_category": "DEPOT_VENTE", "country_code": "CI"},
    {"name": "OLAM International",         "phone": "+225 27 20 36 46 56", "email": "ci-orders@olam.com",       "company_name": "OLAM Côte d'Ivoire",          "entity_type": "BUSINESS", "supplier_category": "REGULAR",     "country_code": "CI"},
    {"name": "Colgate Palmolive AO",       "phone": "+225 27 20 37 47 57", "email": "supply@colgate-ao.com",    "company_name": "Colgate Palmolive AO",        "entity_type": "BUSINESS", "supplier_category": "REGULAR",     "country_code": "CI"},
    {"name": "Danone Afrique",             "phone": "+33 1 44 35 20 20",   "email": "export@danone-afrique.fr", "company_name": "Danone Afrique SAS",          "entity_type": "BUSINESS", "supplier_category": "REGULAR",     "country_code": "FR"},
]

CUSTOMERS = [
    {"name": "Supermarché Hayat",          "phone": "+225 07 01 02 03 04", "email": "achats@hayat-ci.com",      "company_name": "Hayat Supermarché",           "entity_type": "BUSINESS", "customer_tier": "WHOLESALE",   "country_code": "CI"},
    {"name": "Boutique Chez Mariam",       "phone": "+225 05 10 20 30 40", "email": None,                       "company_name": None,                          "entity_type": "INDIVIDUAL", "customer_tier": "RETAIL",    "country_code": "CI"},
    {"name": "PROSUMA Group",              "phone": "+225 27 20 38 48 58", "email": "procurement@prosuma.ci",   "company_name": "PROSUMA SA",                  "entity_type": "BUSINESS", "customer_tier": "WHOLESALE",   "country_code": "CI"},
    {"name": "Casino Supermarchés CI",     "phone": "+225 27 20 39 49 59", "email": "achat@casino-ci.com",      "company_name": "Casino Distribution CI",      "entity_type": "BUSINESS", "customer_tier": "WHOLESALE",   "country_code": "CI"},
    {"name": "Kouadio Jean-Pierre",        "phone": "+225 07 11 22 33 44", "email": "jpierre.k@yahoo.fr",       "company_name": None,                          "entity_type": "INDIVIDUAL", "customer_tier": "STANDARD",  "country_code": "CI"},
    {"name": "Restaurant Le Maquis d'Or",  "phone": "+225 05 55 66 77 88", "email": "contact@maquisor.ci",      "company_name": "Le Maquis d'Or SARL",         "entity_type": "BUSINESS", "customer_tier": "VIP",         "country_code": "CI"},
    {"name": "Pharmacie Centrale Abidjan", "phone": "+225 27 20 40 50 60", "email": "cmd@pharma-centrale.ci",   "company_name": "Pharma Centrale SA",          "entity_type": "BUSINESS", "customer_tier": "STANDARD",    "country_code": "CI"},
    {"name": "Aissatou Diallo",            "phone": "+225 01 22 33 44 55", "email": None,                       "company_name": None,                          "entity_type": "INDIVIDUAL", "customer_tier": "RETAIL",    "country_code": "CI"},
    {"name": "Hôtel Ivoire Sofitel",       "phone": "+225 27 22 48 26 26", "email": "purchasing@sofitel-ci.com", "company_name": "Sofitel Hôtel Ivoire",        "entity_type": "BUSINESS", "customer_tier": "VIP",         "country_code": "CI"},
    {"name": "Ecole Internationale IIAB",  "phone": "+225 27 22 44 55 66", "email": "intendance@iiab.ci",       "company_name": "IIAB Abidjan",                "entity_type": "BUSINESS", "customer_tier": "STANDARD",    "country_code": "CI"},
]


class Command(BaseCommand):
    help = "Seed demo suppliers and clients into the CRM"

    def handle(self, *args, **options):
        from erp.models import Organization
        org = Organization.objects.first()
        if not org:
            self.stderr.write(self.style.ERROR("No organization found. Cannot seed contacts."))
            return

        created_s = 0
        for s in SUPPLIERS:
            _, is_new = Contact.objects.get_or_create(
                organization=org,
                name=s["name"],
                type="SUPPLIER",
                defaults={
                    "phone": s["phone"],
                    "email": s["email"],
                    "company_name": s["company_name"],
                    "entity_type": s["entity_type"],
                    "supplier_category": s["supplier_category"],
                    "country_code": s["country_code"],
                    "status": "ACTIVE",
                    "is_active": True,
                }
            )
            if is_new:
                created_s += 1

        created_c = 0
        for c in CUSTOMERS:
            _, is_new = Contact.objects.get_or_create(
                organization=org,
                name=c["name"],
                type="CUSTOMER",
                defaults={
                    "phone": c["phone"],
                    "email": c.get("email"),
                    "company_name": c.get("company_name"),
                    "entity_type": c["entity_type"],
                    "customer_tier": c["customer_tier"],
                    "country_code": c["country_code"],
                    "status": "ACTIVE",
                    "is_active": True,
                }
            )
            if is_new:
                created_c += 1

        total = created_s + created_c
        self.stdout.write(self.style.SUCCESS(
            f"✅ Seeded {created_s} suppliers + {created_c} clients = {total} contacts (skipped {len(SUPPLIERS) + len(CUSTOMERS) - total} existing)"
        ))
