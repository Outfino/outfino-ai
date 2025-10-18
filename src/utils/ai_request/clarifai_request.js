import { ClarifaiStub, grpc } from 'clarifai-nodejs-grpc';
import fs from 'fs';
import fetch from 'node-fetch';

/**
 * Make a request to Clarifai API for visual analysis
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Optional settings
 * @param {Object} options.config - Configuration object with Clarifai settings
 * @returns {Promise<Object>} - Response in OpenAI-compatible format
 */
export default async function clarifaiRequest(messages, options = {}) {
	try {
		const { config } = options;

		if (!config?.ai?.clarifai) {
			throw new Error('Clarifai configuration is missing');
		}

		const { apiKey, userId, appId, modelId, modelVersionId } = config.ai.clarifai;

		// Initialize Clarifai stub
		const stub = ClarifaiStub.grpc();
		const metadata = new grpc.Metadata();
		metadata.set('authorization', `Key ${apiKey}`);

		// Extract images and text from messages
		const imageBytes = [];
		const textPrompts = [];

		for (const message of messages) {
			if (message.role === 'user') {
				if (typeof message.content === 'string') {
					textPrompts.push(message.content);
				} else if (Array.isArray(message.content)) {
					for (const block of message.content) {
						if (block.type === 'text') {
							textPrompts.push(block.text);
						} else if (block.type === 'image_url') {
							// Download image from URL
							const imageUrl = block.image_url.url;
							const imageBuffer = await downloadImage(imageUrl);
							imageBytes.push(imageBuffer);
						}
					}
				}
			}
		}

		// Combine text prompts
		const promptText = textPrompts.join('\n\n');

		// Build inputs for Clarifai
		const inputs = imageBytes.map(imageBuffer => ({
			data: {
				image: {
					base64: imageBuffer.toString('base64')
				}
			}
		}));

		// Make the request
		return new Promise((resolve, reject) => {
			stub.PostModelOutputs(
				{
					user_app_id: {
						user_id: userId,
						app_id: appId
					},
					model_id: modelId,
					version_id: modelVersionId,
					inputs: inputs,
					model: {
						model_version: {
							output_info: {
								params: {
									// Add the text prompt as a parameter
									prompt: promptText
								}
							}
						}
					}
				},
				metadata,
				(err, response) => {
					if (err) {
						console.error('❌ Clarifai API Error:', err);
						return reject(new Error(`CLARIFAI_REQUEST_FAILED: ${err.message}`));
					}

					if (response.status.code !== 10000) {
						console.error('❌ Clarifai Response Error:', response.status.description);
						return reject(new Error(`CLARIFAI_ERROR: ${response.status.description}`));
					}

					// Extract the output from Clarifai
					const outputs = response.outputs;
					if (!outputs || outputs.length === 0) {
						return reject(new Error('CLARIFAI_NO_OUTPUT'));
					}

					// Get the first output's text
					const output = outputs[0];
					let resultText = '';

					// Check for different output types
					if (output.data.text) {
						resultText = output.data.text.raw || output.data.text.text || '';
					} else if (output.data.concepts && output.data.concepts.length > 0) {
						// If concepts are returned, convert to JSON
						resultText = JSON.stringify(output.data.concepts);
					} else {
						resultText = JSON.stringify(output.data);
					}

					console.log('✅ Clarifai response received, length:', resultText.length);

					// Return in OpenAI-compatible format
					resolve({
						choices: [
							{
								message: {
									role: 'assistant',
									content: resultText.trim()
								}
							}
						]
					});
				}
			);
		});
	} catch (error) {
		console.error('❌ Clarifai Request Failed:', error.message);
		if (error.stack) {
			console.error('Stack trace:', error.stack);
		}
		throw new Error(`AI_REQUEST_FAILED: ${error.message}`);
	}
}

/**
 * Download image from URL
 * @param {string} url - Image URL
 * @returns {Promise<Buffer>} - Image buffer
 */
async function downloadImage(url) {
	// If it's a local file path (starts with http://localhost or file path)
	if (url.includes('localhost') || url.includes('188.36.192.35') || url.startsWith('/')) {
		// Extract the local file path
		const match = url.match(/\/v3\/(.+)$/);
		if (match) {
			const relativePath = match[1];
			const filePath = `/Users/csabanyiro/Desktop/Outfino/Development/Product/api/${relativePath}`;

			try {
				return fs.readFileSync(filePath);
			} catch (error) {
				console.error('❌ Failed to read local file:', filePath);
				throw error;
			}
		}
	}

	// Otherwise download from URL
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download image: ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
}
