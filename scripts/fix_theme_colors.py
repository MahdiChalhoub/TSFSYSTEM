import os

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Replacements for gray text colors
    content = content.replace("text-gray-500", "theme-text-muted")
    content = content.replace("text-gray-400", "theme-text-muted")
    content = content.replace("dark:text-gray-400", "theme-text-muted")
    
    # Replacements for gray background colors
    content = content.replace("bg-gray-100", "bg-app-surface")
    content = content.replace("dark:bg-gray-800", "bg-app-surface")
    content = content.replace("bg-gray-50", "bg-app-surface-hover")
    
    # Replacements for gray border colors
    content = content.replace("border-gray-200", "border-app-border")
    content = content.replace("dark:border-gray-700", "border-app-border")

    # Write back if changed
    with open(filepath, 'w') as f:
        f.write(content)

def main():
    target_dir = 'src/app/(privileged)/purchases'
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                process_file(os.path.join(root, file))
                
    # Also do the other files we found
    extra_files = [
        'src/app/(privileged)/(saas)/saas-home/page.tsx',
        'src/app/(privileged)/migration_v2/page.tsx',
        'src/app/(privileged)/migration_v2/jobs/[id]/mappings/page.tsx',
        'src/app/(privileged)/migration_v2/jobs/[id]/verification/page.tsx'
    ]
    for ef in extra_files:
        if os.path.exists(ef):
            process_file(ef)

if __name__ == '__main__':
    main()
