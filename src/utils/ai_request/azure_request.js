import { AzureOpenAI } from 'openai';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync } from 'fs';

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
 * Convert local image path to base64 data URL
 * @param {string} filePath - Absolute path to the image file
 * @returns {string} - Base64 data URL
 */
function imageToBase64DataUrl(filePath) {
	try {
		const imageBuffer = readFileSync(filePath);
		const base64 = imageBuffer.toString('base64');
		// Detect image type from file extension
		const ext = filePath.split('.').pop().toLowerCase();
		const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
		return `data:${mimeType};base64,${base64}`;
	} catch (error) {
		console.error('❌ Failed to read image file:', filePath, error.message);
		throw error;
	}
}

/**
 * Make a request to Azure OpenAI
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Optional settings
 * @param {Object} options.config - Configuration object from API
 * @param {Object} options.OutfitRatingsDB - Sequelize model for few-shot learning
 * @returns {Promise<Object>} - Azure OpenAI response in OpenAI-compatible format
 */
export default async function azureRequest(messages, options = {}) {
	try {
		const { config } = options;

		if (!config || !config.openAI || !config.openAI.azure) {
			throw new Error('Azure OpenAI configuration is missing');
		}

		const azureConfig = config.openAI.azure;

		// Initialize Azure OpenAI client
		const client = new AzureOpenAI({
			endpoint: azureConfig.endpoint,
			apiKey: azureConfig.text.api.key,
			apiVersion: azureConfig.text.api.version,
			deployment: azureConfig.text.deploymentId
		});

		console.log('🔵 Azure OpenAI client initialized');

		// Fetch few-shot learning examples if OutfitRatingsDB is provided
		const fewShotExamples = await getFewShotExamples(options.OutfitRatingsDB);

		// Build the messages array for Azure OpenAI
		const azureMessages = [];

		// Add few-shot examples as system message if available
		if (fewShotExamples) {
			azureMessages.push({
				role: 'system',
				content: fewShotExamples
			});
		}

		// Process input messages
		for (const message of messages) {
			if (message.role === 'system') {
				// Append to existing system message or create new one
				if (azureMessages.length > 0 && azureMessages[0].role === 'system') {
					azureMessages[0].content += '\n\n' + message.content;
				} else {
					azureMessages.unshift({
						role: 'system',
						content: message.content
					});
				}
			} else if (message.role === 'user') {
				// Handle user message content
				if (typeof message.content === 'string') {
					azureMessages.push({
						role: 'user',
						content: message.content
					});
				} else if (Array.isArray(message.content)) {
					// Build content array for multimodal messages
					const contentArray = [];

					for (const block of message.content) {
						if (block.type === 'text') {
							contentArray.push({
								type: 'text',
								text: block.text
							});
						} else if (block.type === 'image_url') {
							// Convert image URL to base64 for Azure OpenAI
							const imageUrl = block.image_url.url;

							// Check if it's a local file path
							const match = imageUrl.match(/\/v3\/(.+)$/);
							let imageData;

							if (match) {
								// Local file - convert to base64
								const relativePath = match[1];
								const absolutePath = join(API_ROOT, relativePath);
								console.log('📁 Processing local image:', absolutePath);
								imageData = imageToBase64DataUrl(absolutePath);
							} else {
								// External URL - use as is
								imageData = imageUrl;
							}

							contentArray.push({
								type: 'image_url',
								image_url: {
									url: imageData
								}
							});
						}
					}

					azureMessages.push({
						role: 'user',
						content: contentArray
					});
				}
			}
		}

		console.log('🤖 Making Azure OpenAI request with', azureMessages.length, 'messages');

		// Make the API call
		const response = await client.chat.completions.create({
			model: azureConfig.text.deploymentId,
			messages: azureMessages,
			temperature: 0.7,
			max_tokens: 2000
		});

		console.log('✅ Azure OpenAI response received');

		// Return in OpenAI-compatible format (already compatible!)
		return response;

	} catch (error) {
		console.error('❌ Azure OpenAI Request Failed:', error.message);
		if (error.response) {
			console.error('Response error:', error.response.data);
		}
		if (error.stack) {
			console.error('Stack trace:', error.stack);
		}
		// Re-throw with a simple error message
		throw new Error(`AI_REQUEST_FAILED: ${error.message}`);
	}
}
