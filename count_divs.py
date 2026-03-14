with open('/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/crm/contacts/[id]/page.tsx', 'r') as f:
    lines = f.readlines()

openings = 0
closings = 0
for i, line in enumerate(lines):
    # This is a bit naive because of comments and multi-line tags, but let's try
    o = line.count('<div')
    c = line.count('</div>')
    # Simple check for self-closing on the same line
    o -= line.count('/>') if '<div' in line else 0
    
    openings += o
    closings += c
    
    if openings < closings:
        print(f"Excess closings at line {i+1}: {closings - openings}")
        break
    
print(f"Total Openings: {openings}")
print(f"Total Closings: {closings}")
