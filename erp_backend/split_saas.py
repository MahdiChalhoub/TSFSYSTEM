with open("erp/views_saas_modules.py", "r", encoding="utf-8") as f:
    lines = f.read().split("\n")

header = lines[0:14]

def write_f(name, slices, import_base=False):
    with open("erp/" + name, "w", encoding="utf-8") as f:
        f.write("\n".join(header) + "\n\n")
        
        # Additional imports might be needed for SaaS if any, but the header has them all
        
        content = []
        for s in slices:
            content.extend(lines[s[0]:s[1]])
        
        f.write("\n".join(content) + "\n")

# Provide proper slice bounds from outline:
# SaaSUpdateViewSet: 14 to 78
# SaaSModuleViewSet: 79 to 351
# PublicPricingView: 353 to 383
# SaaSPlansViewSet: 385 to 753
# OrgModuleViewSet: 754 to 1429
# SaaSClientViewSet: 1429 to 1614

write_f("views_saas_updates.py", [(14, 78)])
write_f("views_saas_modules_global.py", [(79, 351)])
write_f("views_saas_plans.py", [(353, 753)])
write_f("views_saas_org.py", [(754, 1429)])
write_f("views_saas_clients.py", [(1429, len(lines))])

with open("erp/views_saas_modules.py", "w", encoding="utf-8") as f:
    f.write("# SAAS VIEWS RE-EXPORTS\n")
    f.write("from .views_saas_updates import *\n")
    f.write("from .views_saas_modules_global import *\n")
    f.write("from .views_saas_plans import *\n")
    f.write("from .views_saas_org import *\n")
    f.write("from .views_saas_clients import *\n")

print("Splitting SaaS views completed!")
