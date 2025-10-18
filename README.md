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

The module uses **Claude Code SDK** (`@instantlyeasy/claude-code-sdk-ts`) which delegates authentication to the Claude CLI. This provides **stable, persistent authentication** without token expiration issues.

### Requirements

1. **Claude Code CLI** installed globally:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **One-time authentication** (run once, stays logged in):
   ```bash
   claude login
   ```
   This creates a persistent session in your system keychain - no more "exit code 1" errors!

3. **Anthropic API key** (fallback for image processing):
   ```bash
   export ANTHROPIC_API_KEY="your-anthropic-api-key-here"
   ```
   Only needed for requests with images. Text-only requests use the free Claude CLI authentication.

### How it works

**For text-only requests:**
1. Uses Claude Code SDK with CLI authentication
2. Fluent API: `claude().withModel(...).query(prompt).asText()`
3. No token management needed - CLI handles it automatically

**For requests with images:**
1. Detects image content in the request
2. Automatically falls back to Anthropic SDK (requires API key)
3. Converts image URLs/paths to base64
4. Processes images with Claude API

### Authentication Setup

```bash
# One-time setup (run on the server where the API is deployed)
npm install -g @anthropic-ai/claude-code
claude login

# Follow the browser prompt to authenticate
# Session is saved to keychain - no expiration!

# For image support, also set API key
export ANTHROPIC_API_KEY="your-anthropic-api-key-here"
```

Or add the API key to your `.env` file, `~/.zshrc`, or `~/.bashrc`

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

## Migration History

### From Azure OpenAI → Claude Agent SDK → Claude Code SDK

This module has evolved through multiple AI provider changes:

**v1.0 - Azure OpenAI**
- Original implementation using Azure OpenAI API
- Required API keys and had usage costs

**v2.0 - Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`)
- Migrated to Claude Agent SDK for free Claude Pro integration
- **Problem**: Frequent "exit code 1" errors due to session token expiration

**v3.0 - Claude Code SDK** (`@instantlyeasy/claude-code-sdk-ts`) ✅ Current
- **Fixed**: Token expiration issues with persistent CLI authentication
- **Benefit**: No more manual token regeneration
- **Hybrid**: Uses Claude Code SDK for text, Anthropic SDK for images

Key changes:
1. **Separated module**: Moved all AI-related code to a standalone module
2. **Dependency injection**: All API dependencies are now injected at initialization
3. **Stable auth**: CLI-based authentication with no expiration
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
