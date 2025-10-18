import OpenAI from "openai";
import fs from "fs";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load config from API directory (parent module)
const config = JSON.parse(readFileSync(path.join(__dirname, '../../../../../api/src/config/config.json'), 'utf8'));
const openai = new OpenAI({ apiKey: config.openAI.original.secret });

function loadImageAsBase64(filePath) {
  const imageBuffer = fs.readFileSync(filePath);
  return imageBuffer.toString('base64');
}

export default async function (userId) {
	const base64Image1 = loadImageAsBase64(path.resolve('storage/assets/action_figure/background.png'));
	const base64Image2 = loadImageAsBase64(path.resolve(`storage/users/${userId}/palette.jpg`));

	const prompt = config.openAI.prompts.actionFigure.replace("$background", `${config.domains.api}/storage/assets/action_figure/background.png`).replace("$palette", `${config.domains.api}/storage/users/${userId}/palette.jpg`);

	// const result = await openai.images.generate({
	// 	model: "gpt-image-1",
	// 	prompt,
	// 	// images: [base64Image1, base64Image2],
	// 	size: "1024x1024",
	// 	background: "transparent",
	// 	quality: "low"
	// });
	const result = await openai.images.edit({
		image: `${config.domains.api}/storage/users/${userId}/palette.jpg`,
		prompt,
		model: "gpt-image-1",
		n: 1,
		size: "1024x1536",
		quality: "low",
		background: "transparent",
		moderation: "auto"
	});
	  
	const image_base64 = result.data[0].b64_json;
	const image_bytes = Buffer.from(image_base64, 'base64');
	fs.writeFileSync('sprite.png', image_bytes);
}