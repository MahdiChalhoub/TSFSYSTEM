import re

with open("apps/pos/views/register_views.py", "r", encoding="utf-8") as f:
    lines = f.read().split("\n")

header_lines = lines[:15]
# Find method boundaries inside POSRegisterViewSet

# Using ast to find functions inside POSRegisterViewSet
import ast
src = "\n".join(lines)
tree = ast.parse(src)

class_node = None
for node in tree.body:
    if isinstance(node, ast.ClassDef) and node.name == "POSRegisterViewSet":
        class_node = node
        break

def get_ast_node_source(node, lines):
    # Retrieve preceding comments
    start = node.lineno - 1
    if hasattr(node, "decorator_list") and node.decorator_list:
        start = node.decorator_list[0].lineno - 1
        
    c_idx = start - 1
    comments = []
    while c_idx >= 0 and (lines[c_idx].strip().startswith("#") or not lines[c_idx].strip()):
        comments.insert(0, lines[c_idx])
        c_idx -= 1
        if len(comments) > 1 and not comments[0].strip() and not comments[1].strip():
            comments.pop(0)
            
    node_body = lines[start:node.end_lineno]
    # fix indentation for mixin (decrease indentation by 4 if needed? No, keeping as is is fine if we write it inside a class)
    # Actually, ast line numbers correspond exactly to original lines.
    return "\n".join(comments) + "\n" + "\n".join(node_body)

methods = {}
fields = []
for node in class_node.body:
    if isinstance(node, ast.FunctionDef):
        methods[node.name] = get_ast_node_source(node, lines)
    else:
        # fields like queryset, permission_classes
        fields.append(get_ast_node_source(node, lines))

# Grouping methods
# Lobby & Config
lobby_methods = ['lobby', 'list_registers', 'create_register', 'update_register', 'verify_pin', 'set_pin', 'verify_manager', 'set_override_pin', 'verify_override', 'toggle_driver']
# Session
session_methods = ['open_session', 'close_session', 'session_status', 'session_history']
# Return / Order
order_methods = ['process_return', 'lookup_order']
# Address book
address_book_methods = ['address_book_list', 'address_book_add', 'address_book_review', 'address_book_delete']

def create_mixin(name, method_list):
    res = f"class {name}:\n"
    for m in method_list:
        if m in methods:
            res += methods[m] + "\n\n"
    return res

with open("apps/pos/views/register_lobby.py", "w", encoding="utf-8") as f:
    f.write("\n".join(header_lines) + "\n\n")
    f.write(create_mixin("RegisterLobbyMixin", lobby_methods))

with open("apps/pos/views/register_session.py", "w", encoding="utf-8") as f:
    f.write("\n".join(header_lines) + "\n\n")
    f.write(create_mixin("RegisterSessionMixin", session_methods))

with open("apps/pos/views/register_order.py", "w", encoding="utf-8") as f:
    f.write("\n".join(header_lines) + "\n\n")
    f.write(create_mixin("RegisterOrderMixin", order_methods))
    
with open("apps/pos/views/register_address_book.py", "w", encoding="utf-8") as f:
    f.write("\n".join(header_lines) + "\n\n")
    f.write(create_mixin("RegisterAddressBookMixin", address_book_methods))

with open("apps/pos/views/register_views.py", "w", encoding="utf-8") as f:
    f.write("\n".join(header_lines) + "\n\n")
    f.write("from .register_lobby import RegisterLobbyMixin\n")
    f.write("from .register_session import RegisterSessionMixin\n")
    f.write("from .register_order import RegisterOrderMixin\n")
    f.write("from .register_address_book import RegisterAddressBookMixin\n\n")
    f.write("class POSRegisterViewSet(RegisterLobbyMixin, RegisterSessionMixin, RegisterOrderMixin, RegisterAddressBookMixin, viewsets.ModelViewSet):\n")
    for field in fields:
        f.write(field + "\n")
print("Split pos register views successfully")
