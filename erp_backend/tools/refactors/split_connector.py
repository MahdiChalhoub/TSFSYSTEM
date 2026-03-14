import re
import ast

with open("erp/connector_engine.py", "r", encoding="utf-8") as f:
    lines = f.read().split("\n")

# Find imports and top level stuff (header)
tree = ast.parse("\n".join(lines))
header_end = 0
for node in tree.body:
    if isinstance(node, ast.ClassDef) and node.name == "ConnectorEngine":
        header_end = node.lineno - 1
        class_node = node
        break

header = lines[:header_end]

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
# Resilience / State
state_methods = ['_load_models', '_is_circuit_broken', '_increment_failure', 'get_module_state', 'get_all_module_states', 'get_policy', 'get_fallback_action']
# Routing
routing_methods = ['route_read', 'route_write', '_handle_read_fallback', '_handle_write_fallback', '_validate_response_schema', 'invoke_internal']
# Events
events_methods = ['dispatch_event', '_try_deliver_event']
# Others
core_methods = ['__init__', 'clear_cache']

def create_mixin(name, method_list):
    res = f"class {name}:\n"
    for m in method_list:
        if m in methods:
            res += methods[m] + "\n\n"
    return res

with open("erp/connector_state.py", "w", encoding="utf-8") as f:
    f.write("\n".join(header) + "\n\n")
    f.write(create_mixin("ConnectorStateMixin", state_methods))

with open("erp/connector_routing.py", "w", encoding="utf-8") as f:
    f.write("\n".join(header) + "\n\n")
    f.write(create_mixin("ConnectorRoutingMixin", routing_methods))

with open("erp/connector_events.py", "w", encoding="utf-8") as f:
    f.write("\n".join(header) + "\n\n")
    f.write(create_mixin("ConnectorEventsMixin", events_methods))
    
# We will create connector_core.py as the new connector_engine.py might be tricky if it has the same name while importing mixins, wait, it's fine.
with open("erp/connector_engine.py", "w", encoding="utf-8") as f:
    f.write("\n".join(header) + "\n\n")
    f.write("from .connector_state import ConnectorStateMixin\n")
    f.write("from .connector_routing import ConnectorRoutingMixin\n")
    f.write("from .connector_events import ConnectorEventsMixin\n\n")
    f.write("class ConnectorEngine(ConnectorStateMixin, ConnectorRoutingMixin, ConnectorEventsMixin):\n")
    for m in core_methods:
        if m in methods:
            # indent method by 4 spaces
            method_src = "\n    ".join(methods[m].split("\n"))
            f.write("    " + method_src + "\n\n")
    for f_source in fields:
        field_src = "\n    ".join(f_source.split("\n"))
        f.write("    " + field_src + "\n")
        
print("Connector engine split successfully")
