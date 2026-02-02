
import re

file_path = r'c:\tsfci\prisma\schema.prisma'

with open(file_path, 'r') as f:
    content = f.read()

# Clean up multiple @map occurrences of the same type
content = re.sub(r'@map\("([^"]+)"\)\s+@map\("\1"\)', r'@map("\1")', content)

# Also fix the weird sequence I saw in the error
content = re.sub(r'@map\("([^"]+)"\)\s+(@default\(.*?\)|@updatedAt)\s+@map\("\1"\)', r'\2 @map("\1")', content)

with open(file_path, 'w') as f:
    f.write(content)

print("Cleanup complete.")
