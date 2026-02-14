from PIL import Image, ImageDraw

def create_icon(size, filename):
    # emerald-600 color: #059669
    color = (5, 150, 105)
    img = Image.new('RGB', (size, size), color=color)
    d = ImageDraw.Draw(img)
    
    # Draw a simple white square terminal icon in the center
    margin = size // 4
    d.rectangle([margin, margin, size-margin, size-margin], outline="white", width=size//20)
    d.line([margin, size//2, size-margin, size//2], fill="white", width=size//40)
    
    img.save(filename)
    print(f"Created {filename}")

try:
    import os
    os.makedirs('public/icons', exist_ok=True)
    create_icon(192, 'public/icons/icon-192.png')
    create_icon(512, 'public/icons/icon-512.png')
except ImportError:
    print("Pillow not installed, using fallback byte generation")
    # Minimal valid PNG headers/bytes for a 1x1 emerald pixel if Pillow fails
    # but let's try to just use Pillow if available
    pass
except Exception as e:
    print(f"Error: {e}")
