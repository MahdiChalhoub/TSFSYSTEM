import re
from pathlib import Path

file_path = Path("src/components/pos/lobby/POSLobby.tsx")
content = file_path.read_text()

# Text colors
content = re.sub(r'\btext-white\b', 'text-app-text', content)
content = re.sub(r'\btext-white/(\d+)\b', r'text-app-text/\1', content)
content = re.sub(r'\btext-white/\[(.*?)\]\b', r'text-app-text/[\1]', content)

# Background overlays (we map white overlays to app-text overlays so they contrast against the surface dynamically)
content = re.sub(r'\bbg-white/(\d+)\b', r'bg-app-text/\1', content)
content = re.sub(r'\bbg-white/\[(.*?)\]\b', r'bg-app-text/[\1]', content)

# Borders
content = re.sub(r'\bborder-white/(\d+)\b', r'border-app-text/\1', content)
content = re.sub(r'\bborder-white/\[(.*?)\]\b', r'border-app-text/[\1]', content)

file_path.write_text(content)
print("POSLobby.tsx patched successfully!")
