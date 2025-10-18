import { claude } from '@instantlyeasy/claude-code-sdk-ts';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Calculate API root dynamically (outfino-ai/src/utils/ai_request -> ../../../../api)
const API_ROOT = resolve(__dirname, '../../../../api');

/**
 * Fetch training examples from outfit ratings with user feedback
 * @param {Object} OutfitRatingsDB - Sequelize model
 * @returns {Promise<string>} - Few-shot examples as formatted string
 */
async function getFewShotExamples(OutfitRatingsDB) {
	if (!OutfitRatingsDB) return '';

	try {
		// Fetch good examples (VERY_ACCURATE)
		const goodExamples = await OutfitRatingsDB.findAll({
			where: { accuracyRating: 'VERY_ACCURATE' },
			limit: 2,
			order: [['feedbackTimestamp', 'DESC']],
			attributes: ['response', 'userFeedback']
		});

		// Fetch bad examples (INACCURATE) to learn what NOT to do
		const badExamples = await OutfitRatingsDB.findAll({
			where: { accuracyRating: 'INACCURATE' },
			limit: 1,
			order: [['feedbackTimestamp', 'DESC']],
			attributes: ['response', 'userFeedback']
		});

		let examplesText = '\n\n=== LEARNING FROM USER FEEDBACK ===\n';

		if (goodExamples.length > 0) {
			examplesText += '\n✅ GOOD EXAMPLES (User marked as VERY ACCURATE):\n';
			goodExamples.forEach((example, idx) => {
				examplesText += `\nExample ${idx + 1}:\n${JSON.stringify(example.response, null, 2)}\n`;
			});
		}

		if (badExamples.length > 0) {
			examplesText += '\n❌ WHAT NOT TO DO (User marked as INACCURATE):\n';
			badExamples.forEach((example, idx) => {
				examplesText += `\nBad Example ${idx + 1}:\n${JSON.stringify(example.response, null, 2)}\n`;
				if (example.userFeedback) {
					examplesText += `User feedback: "${example.userFeedback}"\n`;
				}
			});
		}

		examplesText += '\n=== NOW ANALYZE THE NEW IMAGE ===\n\n';

		return examplesText;
	} catch (error) {
		console.warn('⚠️ Could not fetch few-shot examples:', error.message);
		return '';
	}
}

/**
 * Make a request to Claude using Claude Code SDK (uses Claude CLI authentication)
 * This SDK delegates authentication to the Claude CLI - run `claude login` once to set up
 * Images are handled via the Read tool - images must be saved to disk first
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Optional settings
 * @param {Object} options.OutfitRatingsDB - Sequelize model for few-shot learning
 * @returns {Promise<Object>} - Claude's response in OpenAI-compatible format
 */
export default async function claudeRequest(messages, options = {}) {
	try {
		// Claude Code SDK uses CLI authentication - run `claude login` once!
		// No API keys needed, no token expiration issues!

		// Fetch few-shot learning examples if OutfitRatingsDB is provided
		const fewShotExamples = await getFewShotExamples(options.OutfitRatingsDB);

		// Build the prompt from messages
		const promptParts = [];

		// Add few-shot examples before other content
		if (fewShotExamples) {
			promptParts.push(fewShotExamples);
		}

		// Extract all text content and convert image URLs to file paths
		for (const message of messages) {
			if (message.role === 'system') {
				// System messages go at the beginning
				promptParts.unshift(message.content);
			} else if (message.role === 'user') {
				// Handle user message content
				if (typeof message.content === 'string') {
					promptParts.push(message.content);
				} else if (Array.isArray(message.content)) {
					// Extract text and images from content blocks
					for (const block of message.content) {
						if (block.type === 'text') {
							promptParts.push(block.text);
						} else if (block.type === 'image_url') {
							// Convert image URL to absolute file path
							const imageUrl = block.image_url.url;
							const match = imageUrl.match(/\/v3\/(.+)$/);

							if (match) {
								const relativePath = match[1];
								const absolutePath = join(API_ROOT, relativePath);
								console.log('📁 Image path:', absolutePath);

								// Add instruction for Claude to analyze the image using Read tool
								promptParts.push(`Please analyze the image at "${absolutePath}" using the Read tool.`);
							} else {
								console.warn('⚠️ Could not parse image URL:', imageUrl);
							}
						}
					}
				}
			}
		}

		const prompt = promptParts.join('\n\n');
		console.log('🤖 Making Claude Code SDK request with prompt length:', prompt.length);

		// Use Claude Code SDK with Read tool enabled for images
		const resultText = await claude()
			.withModel('claude-sonnet-4-5-20250929')
			.withEnv({ ANTHROPIC_API_KEY: undefined }) // Remove invalid API key, use CLI authentication
			.debug(true) // Enable debug output to see exact CLI command and errors
			.addDirectory(API_ROOT) // Allow CLI access to API directory
			.allowTools('Read') // Enable Read tool for image processing
			.skipPermissions() // Auto-accept all permissions
			.withTimeout(120000) // 2 minute timeout
			.query(prompt)
			.asText();

		console.log('✅ Claude Code SDK response received, length:', resultText.length);
		console.log('📄 Response content:', resultText);

		// Extract JSON from response (may be wrapped in markdown code blocks or have extra text)
		let jsonContent = resultText;

		// Remove markdown code blocks if present
		const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (jsonMatch) {
			jsonContent = jsonMatch[1];
		}

		// Trim any leading text before the JSON
		const jsonStart = jsonContent.indexOf('{');
		if (jsonStart > 0) {
			jsonContent = jsonContent.substring(jsonStart);
		}

		// Trim any trailing text after the JSON
		const jsonEnd = jsonContent.lastIndexOf('}');
		if (jsonEnd > 0 && jsonEnd < jsonContent.length - 1) {
			jsonContent = jsonContent.substring(0, jsonEnd + 1);
		}

		console.log('📋 Extracted JSON content:', jsonContent);

		// Return in OpenAI-compatible format
		return {
			choices: [
				{
					message: {
						role: 'assistant',
						content: jsonContent.trim()
					}
				}
			]
		};
	} catch (error) {
		console.error('❌ Claude Code SDK Request Failed:', error.message);
		if (error.stack) {
			console.error('Stack trace:', error.stack);
		}
		// Re-throw with a simple error message
		throw new Error(`AI_REQUEST_FAILED: ${error.message}`);
	}
}
