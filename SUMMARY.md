# Summary

* [Introduction](README.md)
* [Getting Started](getting-started/README.md)
  * [Installation](getting-started/installation.md)
  * [Quick Start](getting-started/quick-start.md)
* [Configuration](configuration/README.md)
  * [Basic Options](configuration/basic-options.md)
  * [Theme Customization](configuration/theme.md)
  * [Text Configuration](configuration/text.md)
* [API Reference](api-reference/README.md)
  * [Methods](api-reference/methods.md)
  * [Events](api-reference/events.md)
* [Examples](examples/README.md)
  * [Basic Implementation](examples/basic.md)
  * [Advanced Usage](examples/advanced.md)

## Content for each file:

### README.md
```markdown
# Prophet Swap Documentation

Prophet Swap is a customizable token swap interface that can be easily integrated into any web application.

## Features
- Dark/Light theme support
- Customizable UI
- Wallet integration
- Real-time price quotes
- Transaction status tracking
```

### getting-started/installation.md
```markdown
# Installation

Include the required files in your HTML:

```html
<script src="prophet-swap.js"></script>
<link rel="stylesheet" href="prophet-swap.css">
```

Add the component to your page:
```html
<token-swap-chat
    theme="dark"
    default-tokens="KAS,KRTO,PINTL,NACHO"
    default-buy-token="PINTL">
</token-swap-chat>
```
```

### configuration/basic-options.md
```markdown
# Basic Configuration

## Available Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| theme | string | "light" | UI theme ("light" or "dark") |
| default-tokens | string | "" | Comma-separated list of tokens |
| default-buy-token | string | undefined | Default token for quick buy |
| title | string | "Prophet Swap" | Chat window title |
| subtitle | string | "Available commands: /swap, /buy" | Chat window subtitle |
```

### configuration/theme.md
```markdown
# Theme Customization

## Using JavaScript
```javascript
const chat = document.querySelector('token-swap-chat');

chat.updateTheme({
    colors: {
        primary: '#6200ee',
        background: '#ffffff',
        text: '#1a1a1a'
    },
    dimensions: {
        height: '700px',
        width: '500px'
    },
    borderRadius: {
        container: '16px',
        button: '8px'
    }
});
```

## Available Theme Options

### Colors
- primary
- primaryHover
- background
- text
- border
- messageUser
- messageBot

### Dimensions
- height
- width
- padding

### Border Radius
- container
- button
- input
```

### api-reference/methods.md
```markdown
# API Methods

## Connection Management
```javascript
// Connect wallet
await chat.connect();

// Disconnect wallet
await chat.disconnect();
```

## Chat Management
```javascript
// Reset chat
await chat.reset();

// Get chat history
const history = chat.getHistory();
```

## Configuration
```javascript
// Update theme
chat.updateTheme(themeConfig);

// Update text
chat.updateText(textConfig);
```
```

### api-reference/events.md
```markdown
# Events

## Available Events

| Event | Description | Detail |
|-------|-------------|---------|
| stateChanged | Wallet connection state changes | KaswareState |
| message | New message added | MessageData |
| error | Error occurred | MessageData |

## Usage Example
```javascript
chat.addEventListener('message', (e) => {
    console.log('New message:', e.detail);
});
```
```