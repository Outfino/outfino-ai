import { ApiError } from "../api_error.js";
import { AzureOpenAI } from "openai";
import { StatusCodes } from "../status_codes.js";
import { ErrorCodes } from "../error_codes.js";
import config from '../../config/config.json' with { type: "json" };

export default async function azureOpenAIRequest(messages) {
	try {
		const endpoint = config.openAI.azure.endpoint;
		const deployment = config.openAI.azure.text.deploymentId;
		const apiKey = config.openAI.azure.text.api.key;
		const apiVersion = config.openAI.azure.text.api.version;

		const client = new AzureOpenAI({ endpoint, apiKey, deployment, apiVersion });
		const response = await client.chat.completions.create({ model: "gpt-4o", messages });

		return response;
	} catch (e) {
		console.error('Azure OpenAI Request Failed:', e.message, e.stack);
		throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, ErrorCodes.AI_REQUEST_FAILED);
	}
}