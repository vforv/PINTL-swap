# Token Swap Chat Component

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Development server:
```bash
npm start
```
This will open the demo page at http://localhost:9000

3. Production build:
```bash
npm run build
```
The built files will be in the `dist` directory

4. Development build with source maps:
```bash
npm run build:dev
```

5. Watch mode (for development):
```bash
npm run watch
```

## Project Structure

```
token-swap-chat/
├── src/
│   ├── components/       # Web components
│   ├── controllers/      # Business logic
│   ├── interfaces/       # TypeScript interfaces
│   ├── models/          # Data models
│   ├── types/           # TypeScript types
│   └── index.ts         # Main entry point
├── public/
│   └── index.html       # Demo page
├── dist/                # Built files
├── webpack.config.js    # Webpack configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Project configuration
```

## Development

1. Start the development server:
```bash
npm start
```

2. Use the available commands in the chat:
- `/swap` - Start a token swap
- `/buy` - Buy tokens with KAS

3. Check the event log for component events

4. Use the control buttons to:
- Reset the chat
- Clear the event log
- Toggle dark/light theme

## Building for Production

1. Create a production build:
```bash
npm run build
```

2. Test the production build:
```bash
npx serve dist
```

## Integration

To use the component in another project:

1. Import the component:
```javascript
import 'token-swap-chat';
```

2. Use in HTML:
```html
<token-swap-chat></token-swap-chat>
```

## Attributes

- `theme`: 'light' | 'dark'
- `disabled`: boolean

## Events

- `swapconfirmed`: Emitted when a swap is confirmed
- `error`: Emitted when an error occurs

## Methods

- `reset()`: Reset the chat state
- `getHistory()`: Get chat history