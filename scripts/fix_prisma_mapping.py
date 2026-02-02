
import re

file_path = r'c:\tsfci\prisma\schema.prisma'

with open(file_path, 'r') as f:
    content = f.read()

# Map organizationId
content = re.sub(r'(organizationId\s+String\??)(?!\s+@map)', r'\1 @map("organization_id")', content)

# Map isActive
content = re.sub(r'(isActive\s+Boolean.*?)(?!\s+@map)', r'\1 @map("is_active")', content)

# Map createdAt
content = re.sub(r'(createdAt\s+DateTime.*?)(?!\s+@map)', r'\1 @map("created_at")', content)

# Map updatedAt
content = re.sub(r'(updatedAt\s+DateTime.*?)(?!\s+@map)', r'\1 @map("updated_at")', content)

with open(file_path, 'w') as f:
    f.write(content)

print("Replacement complete.")
