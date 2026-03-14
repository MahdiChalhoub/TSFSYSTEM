with open("erp/views.py", "r", encoding="utf-8") as f:
    lines = f.read().split("\n")

header = lines[0:71]

base_cls = lines[71:187]
users_cls = lines[187:397] + lines[913:916] + lines[1444:1460]
system_cls = lines[399:592] + lines[953:1050] + lines[1462:1495]
org_cls = lines[594:908] + lines[918:948] + lines[1434:1442]
dash_cls = lines[1056:1378]

def write_f(name, content_lines, import_base=True):
    with open("erp/" + name, "w", encoding="utf-8") as f:
        f.write("\n".join(header) + "\n\n")
        if import_base:
            f.write("from .views_base import TenantModelViewSet\n\n")
        f.write("\n".join(content_lines) + "\n")

write_f("views_base.py", base_cls, False)
write_f("views_users.py", users_cls, True)
write_f("views_system.py", system_cls, True)
write_f("views_org.py", org_cls, True)
write_f("views_dashboard.py", dash_cls, True)

with open("erp/views.py", "w", encoding="utf-8") as f:
    f.write("# KERNEL VIEWS RE-EXPORTS\n")
    f.write("from .views_base import *\n")
    f.write("from .views_users import *\n")
    f.write("from .views_org import *\n")
    f.write("from .views_dashboard import *\n")
    f.write("from .views_system import *\n")

print("Splitting complete! Original file replaced with re-exports.")
