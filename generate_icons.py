"""Generate PWA icons for Braindump app."""
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, output_path):
    """Create a simple icon with the Braindump logo."""
    # Create image with dark background
    img = Image.new('RGB', (size, size), color='#1a1a2e')
    draw = ImageDraw.Draw(img)

    # Draw a brain/bulb icon using circles and shapes
    # Use accent color #7f5af0 (purple) for the icon
    accent = '#7f5af0'

    # Draw a simple brain icon (circles and curves)
    center_x, center_y = size // 2, size // 2
    radius = int(size * 0.3)

    # Main circle for brain
    draw.ellipse(
        [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
        fill=accent,
        outline=accent
    )

    # Add "bumps" to make it look more brain-like
    bump_size = int(radius * 0.5)
    draw.ellipse(
        [center_x - radius - bump_size//2, center_y - bump_size,
         center_x - radius + bump_size//2, center_y + bump_size],
        fill=accent
    )
    draw.ellipse(
        [center_x + radius - bump_size//2, center_y - bump_size,
         center_x + radius + bump_size//2, center_y + bump_size],
        fill=accent
    )

    # Add a "pen" or "pencil" mark in white
    pen_color = 'white'
    pen_width = max(2, size // 64)
    # Draw a simple checkmark/pen stroke
    points = [
        (center_x - radius//3, center_y),
        (center_x - radius//6, center_y + radius//3),
        (center_x + radius//2, center_y - radius//2)
    ]
    draw.line(points, fill=pen_color, width=pen_width, joint='curve')

    # Save the image
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, 'PNG')
    print(f"Created icon: {output_path} ({size}x{size})")

if __name__ == '__main__':
    # Create icons directory
    icons_dir = 'web/icons'

    # Generate icons in required sizes
    create_icon(192, f'{icons_dir}/icon-192.png')
    create_icon(512, f'{icons_dir}/icon-512.png')

    print("\nPWA icons generated successfully!")
    print("Icons are located in web/icons/")
