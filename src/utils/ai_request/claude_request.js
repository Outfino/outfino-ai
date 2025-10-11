import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

/**
 * Make a request to Claude using Claude Agent SDK (uses Claude Pro subscription, no API costs!)
 * This uses the same Agent SDK that powers Claude Code CLI
 * @param {Array} messages - Array of message objects with role and content
 * @returns {Promise<Object>} - Claude's response in OpenAI-compatible format
 */
export default async function claudeRequest(messages) {
	try {
		// Check for Claude Code OAuth token (from Claude Pro subscription)
		const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;

		if (!oauthToken) {
			throw new Error('CLAUDE_CODE_OAUTH_TOKEN environment variable is not set. Get it from: claude setup-token');
		}

		// Extract text prompts and image URLs from messages
		const userMessage = messages.find(m => m.role === 'user');
		if (!userMessage) {
			throw new Error('No user message found in request');
		}

		// Convert message content to Claude Agent SDK format (APIUserMessage)
		const contentBlocks = [];

		for (const content of userMessage.content) {
			if (content.type === 'text') {
				contentBlocks.push({
					type: 'text',
					text: content.text
				});
			} else if (content.type === 'image_url') {
				// Extract local file path from URL
				// URL format: http://domain/v3/storage/users/123/outfit.jpg
				const url = content.image_url.url;
				const match = url.match(/\/v3\/(.+)$/);

				if (match) {
					// Convert to absolute file path
					const relativePath = match[1];
					const absolutePath = `/Users/csabanyiro/Desktop/Outfino/Development/Product/api/${relativePath}`;

					// Read image file and convert to base64
					const imageBuffer = readFileSync(absolutePath);
					const base64Image = imageBuffer.toString('base64');

					// Detect image type from file extension
					let mediaType = 'image/jpeg';
					if (absolutePath.endsWith('.png')) {
						mediaType = 'image/png';
					} else if (absolutePath.endsWith('.gif')) {
						mediaType = 'image/gif';
					} else if (absolutePath.endsWith('.webp')) {
						mediaType = 'image/webp';
					}

					contentBlocks.push({
						type: 'image',
						source: {
							type: 'base64',
							media_type: mediaType,
							data: base64Image
						}
					});
				}
			}
		}

		console.log('🤖 Making Claude Agent SDK request with', contentBlocks.filter(c => c.type === 'text').length, 'text prompts and', contentBlocks.filter(c => c.type === 'image').length, 'images');

		// Create AsyncIterable for SDKUserMessage format
		const sessionId = randomUUID();
		const messageIterable = async function*() {
			yield {
				type: 'user',
				uuid: randomUUID(),
				session_id: sessionId,
				message: {
					role: 'user',
					content: contentBlocks
				},
				parent_tool_use_id: null
			};
		}();

		// Make request using Claude Agent SDK with image support
		// This uses Claude Pro subscription, no API costs!
		let resultText = '';

		for await (const msg of query({
			prompt: messageIterable,
			options: {
				maxTurns: 1,
				model: 'claude-sonnet-4-5-20250929'
			}
		})) {
			if (msg.type === 'result') {
				resultText = msg.result;
				console.log('✅ Claude Agent SDK response received, length:', resultText.length);
			}
		}

		// Return in OpenAI-compatible format
		return {
			choices: [
				{
					message: {
						role: 'assistant',
						content: resultText
					}
				}
			]
		};
	} catch (error) {
		console.error('❌ Claude Agent SDK Request Failed:', error.message);
		if (error.stack) {
			console.error('Stack trace:', error.stack);
		}
		// Re-throw with a simple error message
		throw new Error(`AI_REQUEST_FAILED: ${error.message}`);
	}
}
