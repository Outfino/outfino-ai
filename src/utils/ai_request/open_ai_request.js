export default processWithOpenAI = async (messages) => {
	const OpenAI = require("openai");
	const openai = new OpenAI({ apiKey: config.openAI.original.secret });

	const response = await openai.chat.completions.create({ model: "gpt-4o", messages });
	return response;
}