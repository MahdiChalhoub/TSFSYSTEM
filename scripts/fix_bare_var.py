#!/usr/bin/env python3
"""
Fix unquoted var(--app-*) values inside JSX style={{}} objects.
The sed script replaced '#6366F1' → var(--app-primary) but stripped the quotes.
We need background: var(--app-primary) → background: 'var(--app-primary)'
"""
import re
import glob

# Pattern: inside style={{ ... }}, find bare var(--...) that are not quoted
# We look for: background: var( or color: var( where it's not inside quotes
# Strategy: find `: var(--` not preceded by a quote char
BARE_VAR_PATTERN = re.compile(r"(:\s*)(var\(--[a-z-]+(?:/\d+)?\))", re.MULTILINE)

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Only fix bare var() in JSX style attributes (not already in quotes)
    # Find style={{ ... }} blocks and fix bare var()
    # Simple approach: find all occurrences of `: var(--` and check if quoted
    def fix_bare_var(m):
        prefix = m.group(1)  # ": " or ":  " etc
        var_val = m.group(2)  # var(--app-primary)
        # Check what's before the colon
        return f"{prefix}'{var_val}'"
    
    # We need to be careful - only fix in style objects, not in strings
    # Look for pattern where var() is not wrapped in quotes
    # Check character before var(
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        # Check if line contains a style={{}} context
        if 'var(--' in line:
            # Find all occurrences of var(--...) and check surrounding chars
            new_line = ''
            i = 0
            while i < len(line):
                if line[i:].startswith('var(--'):
                    # Check character before
                    char_before = line[i-1] if i > 0 else ''
                    if char_before not in ("'", '"', '(', '/'):
                        # Check if the preceding part ends with ': ' or ':  '
                        preceding = line[:i]
                        if preceding.rstrip().endswith(':'):
                            # Find end of var()
                            j = i + 4  # skip 'var('
                            depth = 1
                            while j < len(line) and depth > 0:
                                if line[j] == '(':
                                    depth += 1
                                elif line[j] == ')':
                                    depth -= 1
                                j += 1
                            var_text = line[i:j]
                            new_line += "'" + var_text + "'"
                            i = j
                            continue
                new_line += line[i]
                i += 1
            new_lines.append(new_line)
        else:
            new_lines.append(line)
    
    content = '\n'.join(new_lines)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False


files = glob.glob('src/app/(privileged)/**/*.tsx', recursive=True)
changed = 0
for fp in files:
    try:
        if fix_file(fp):
            changed += 1
    except Exception as e:
        print(f"Error in {fp}: {e}")

print(f"Fixed {changed} files")
