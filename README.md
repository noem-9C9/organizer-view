# Organizer View 🗂️

![Organizer View](https://github.com/noem-9C9/organizer-view/raw/main/logo.png)

A dynamic, collapsible accordion view for Home Assistant Lovelace. Organize your cards into sleek, foldable sections with a native editing experience.

![Preview](https://raw.githubusercontent.com/noem-9C9/organizer-view/main/preview.gif)

## Features

- **Dynamic Sections**: Group cards using simple Markdown delimiters.
- **Accordion Style**: Save space by folding/unfolding sections.
- **Persistence**: Remembers which sections were folded in your browser's local storage.
- **Native Editing**: Full integration with the Home Assistant card editor (Move, Edit, Delete).
- **Custom Overlays**: Sleek, modern hover effects for quick actions.
- **Drag & Drop Ready**: Supports native Home Assistant card reordering.

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant.
2. Go to **Frontend**.
3. Click the three dots in the top right corner and select **Custom repositories**.
4. Paste the URL of this repository and select **Plugin** as the category.
5. Click **Add** and then **Install**.

### Manual Installation

1. Download `organizer-view.js` from the latest release.
2. Copy it to your `www` folder.
3. Add the resource in Home Assistant:
   - Type: `JavaScript Module`
   - URL: `/local/organizer-view.js`

## Usage

Set your view type to `custom:organizer-view`:

```yaml
type: custom:organizer-view
title: My Dashboard
cards:
  # This card acts as a section delimiter
  - type: markdown
    title: Kitchen
    content: "###### section delimiter"
  - type: light
    entity: light.kitchen_main
  
  # New section starts here
  - type: markdown
    title: Living Room
    content: "###### section delimiter"
  - type: media-player
    entity: media_player.tv
```

## Configuration

The component uses a Markdown card with specific content to identify section starts:
- **Type**: `markdown`
- **Content**: `###### section delimiter`
- **Title**: This will be the name displayed in the accordion header.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
