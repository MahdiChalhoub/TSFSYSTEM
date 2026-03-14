import sys

def check_jsx_balance(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    stack = []
    tags = []
    
    import re
    # Simple regex for opening and closing tags
    # This is naive but might catch major mismatches
    pattern = re.compile(r'<(/?)([a-zA-Z0-9\.]+)([^>]*)>')
    
    for match in pattern.finditer(content):
        closing = match.group(1) == '/'
        tag_name = match.group(2)
        attributes = match.group(3)
        
        # Self-closing
        if not closing and attributes.strip().endswith('/'):
            continue
            
        if closing:
            if not stack:
                print(f"Error: Unexpected closing tag </{tag_name}> at position {match.start()}")
                return
            last_tag = stack.pop()
            if last_tag != tag_name:
                print(f"Error: Tag mismatch. Expected </{last_tag}> but found </{tag_name}> at position {match.start()}")
                # Try to recover or just stop
                # return
        else:
            stack.append(tag_name)
    
    if stack:
        print(f"Error: Unclosed tags: {stack}")
    else:
        print("Success: JSX tags seem balanced.")

if __name__ == "__main__":
    check_jsx_balance(sys.argv[1])
