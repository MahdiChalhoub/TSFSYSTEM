import os
import re

def scan_react_files(start_path):
    issues = []
    
    # Matches useState for filters context
    state_regex = re.compile(r'const\s+\[(.*?)\]\s*=\s*useState')
    # Matches load function or fetch
    load_regex = re.compile(r'(?:const\s+load\s*=\s*|function\s+load\s*\()')
    # Matches useEffect
    effect_regex = re.compile(r'useEffect\(\s*\(\)\s*=>\s*\{.*?(?:load\(\)|fetchData\(\)).*?\}\s*,\s*\[(.*?)\]', re.DOTALL)
    
    for root, dirs, files in os.walk(start_path):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.jsx'):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    states = state_regex.findall(content)
                    state_vars = [s.split(',')[0].strip() for s in states]
                    
                    # If this file has a load() function AND state variables, verify if they are connected
                    if load_regex.search(content) and effect_regex.search(content):
                        effect_match = effect_regex.search(content)
                        deps = effect_match.group(1).split(',')
                        deps = [d.strip() for d in deps if d.strip()]
                        
                        # Find state variables that look like filters (search, query, filter, date, status)
                        filter_vars = [v for v in state_vars if 'search' in v.lower() or 'filter' in v.lower() or 'date' in v.lower() or 'status' in v.lower() or 'query' in v.lower()]
                        
                        unwired_filters = [fv for fv in filter_vars if fv not in deps and fv + 'Id' not in deps]
                        
                        if unwired_filters:
                            # Verify if these unwired filters are used in the UI
                            # e.g., value={filterVar}
                            for uv in unwired_filters:
                                if f"value={{{uv}}}" in content or f"onChange={{(e) => set{uv[0].upper() + uv[1:]}(e.target.value)}}" in content:
                                    issues.append(f"UNWIRED FILTER in {file_path}:\n  -> State '{uv}' is bound to UI but NOT passed into the useEffect dependency array. When the user types, the UI updates but data is never fetched!\n")

    return issues

if __name__ == "__main__":
    src_dir = '/root/.gemini/antigravity/scratch/TSFSYSTEM/src'
    if os.path.exists(src_dir):
        issues = scan_react_files(src_dir)
        if issues:
            print("Found Potentially Unwired Filters:")
            for issue in issues:
                print(issue)
        else:
            print("No obvious unwired filters found via heuristic scan.")
    else:
        print("src directory not found.")
