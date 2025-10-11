# Outfino AI Module

Claude-powered AI module for image analysis and outfit rating functionality in the Outfino API.

## Overview

This module has been extracted from the main Outfino API to provide a standalone, modular AI service. It uses **Claude CLI** (running locally) instead of Azure OpenAI for image analysis and outfit evaluation.

## Features

- **Outfit Rating**: AI-powered outfit analysis with scoring and feedback
- **Suits Me Rating**: Evaluates how well a garment matches the user's style palette
- **Which Is Better**: Compares two garments to determine which fits better with an outfit
- **Generate Palette**: Analyzes face shape, skin tone, and generates personalized color palettes

## Architecture

The module follows a dependency injection pattern, where all API dependencies (database models, utilities, config) are injected from the main API at initialization time.

```
outfino-ai/
├── index.js                        # Main export with initialize function
├── package.json                    # Module dependencies
├── README.md                       # This file
└── src/
    ├── controllers/
    │   ├── ai_controller.js        # Controller factory with dependency injection
    │   └── methods/
    │       └── ai/                 # AI method implementations
    │           ├── outfit_rating.js
    │           ├── suits_me_rating.js
    │           ├── which_is_better_rating.js
    │           └── generate_palette.js
    ├── routes/
    │   └── ai_routes.js            # Express router factory
    └── utils/
        └── ai_request/
            └── claude_request.js   # Claude CLI integration
```

## Usage

### Integration with Outfino API

```javascript
import outfinoAI from '../../outfino-ai/index.js';

// Prepare API dependencies
const apiDeps = {
    respondOK,
    respondError,
    StatusCodes,
    OutfitRatingsDB,
    mkdir,
    StoragePaths,
    saveFile,
    validateRequestToken,
    validateRequestUser,
    ApiError,
    config,
    ErrorCodes,
    rmdir,
    IdealColorsDB,
    Analytics,
    FunctionCodes,
    getPalette,
    generateActionFigure
};

// Initialize the module
const aiModule = outfinoAI.initialize(apiDeps);

// Mount routes
app.use('/v3/ai', aiModule.routes);
```

### API Endpoints

All endpoints require authentication via Bearer token in the `Authorization` header.

#### 1. Outfit Rating
```
POST /v3/ai/rating/outfit-rating
Content-Type: multipart/form-data

Body:
- files: Image file of the outfit
- language: User language (en/hu)
```

#### 2. Suits Me Rating
```
POST /v3/ai/rating/suits-me
Content-Type: multipart/form-data

Body:
- files: Image file of the garment
- language: User language (en/hu)
```

#### 3. Which Is Better
```
POST /v3/ai/rating/which-is-better
Content-Type: multipart/form-data

Body:
- files[0]: Outfit image
- files[1]: First garment image
- files[2]: Second garment image
- language: User language (en/hu)
```

#### 4. Generate Palette
```
POST /v3/ai/generate-palette
Content-Type: multipart/form-data

Body:
- files: Face image for palette analysis
```

## Claude Integration

The module uses the **Anthropic SDK** to process image analysis requests via Claude API.

### Requirements

- Anthropic API key (sign up at https://console.anthropic.com/)
- Set the `ANTHROPIC_API_KEY` environment variable

### How it works

1. Extracts text prompts and image URLs from the request
2. Converts image URLs to absolute file paths
3. Reads image files and converts them to base64
4. Makes API request to Claude with text prompts and base64-encoded images
5. Returns the response in OpenAI-compatible format

### Environment Setup

```bash
export ANTHROPIC_API_KEY="your-anthropic-api-key-here"
```

Or add it to your `.env` file or `~/.zshrc`/`~/.bashrc`

## Configuration

The module expects the following configuration in `config.json`:

```json
{
  "ai": {
    "provider": "claude",
    "claude": {
      "command": "claude",
      "model": "claude-sonnet-4.5"
    }
  },
  "openAI": {
    "prompts": {
      "tone": "...",
      "rules": "...",
      "outfitRating": "...",
      "suitsMe": "...",
      "whichIsBetter": "...",
      "analyzePalette": "...",
      "garmentCategories": "..."
    }
  }
}
```

## Development

### Install Dependencies

```bash
npm install
```

### Dependencies

- `express`: Web framework for routing
- `multer`: Multipart form data handling for file uploads

## Migration from Azure OpenAI

This module was originally part of the main API and used Azure OpenAI. Key changes during migration:

1. **Separated module**: Moved all AI-related code to a standalone module
2. **Dependency injection**: All API dependencies are now injected at initialization
3. **Claude CLI**: Replaced Azure OpenAI SDK with local Claude CLI execution
4. **Same prompts**: Reused existing prompts from config.json
5. **Compatible responses**: Returns responses in the same format as Azure OpenAI

## Future Improvements

- [ ] Add error handling for missing Claude CLI
- [ ] Add retry logic for failed Claude requests
- [ ] Implement response caching for identical requests
- [ ] Add metrics and logging for AI request performance
- [ ] Support multiple AI providers (Claude API, OpenAI, Azure, etc.)
- [ ] Add unit tests for AI controllers and methods

## License

ISC
