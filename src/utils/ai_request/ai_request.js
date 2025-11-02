import claudeRequest from './claude_request.js';
import clarifaiRequest from './clarifai_request.js';
import azureRequest from './azure_request.js';

/**
 * Route AI requests to the appropriate provider based on configuration
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Optional settings
 * @param {Object} options.config - Configuration object from API
 * @param {Object} options.OutfitRatingsDB - Sequelize model for few-shot learning (Claude and Azure)
 * @returns {Promise<Object>} - AI response in OpenAI-compatible format
 */
export default async function aiRequest(messages, options = {}) {
	const { config } = options;

	if (!config || !config.ai) {
		throw new Error('AI configuration is missing');
	}

	const provider = config.ai.provider || 'clarifai';

	console.log(`🤖 Using AI provider: ${provider}`);

	switch (provider) {
		case 'claude':
			console.log('📤 Routing to Claude...');
			return await claudeRequest(messages, options);

		case 'azure':
			console.log('📤 Routing to Azure OpenAI...');
			return await azureRequest(messages, { ...options, config });

		case 'clarifai':
			console.log('📤 Routing to Clarifai...');
			return await clarifaiRequest(messages, { ...options, config });

		default:
			throw new Error(`Unknown AI provider: ${provider}. Supported providers: claude, azure, clarifai`);
	}
}
