import claudeRequest from "../../../utils/ai_request/claude_request.js";

export default async function outfitRating(req, res, apiDeps) {
	// apiDeps contains all API dependencies injected from the main API
	const {
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
		Analytics,
		FunctionCodes,
		getPalette
	} = apiDeps;
	let rating;
	let ratingFolderPath;
	try {
		const token = await validateRequestToken(req.headers.authorization);
		const language = req.headers.language;

		const userId = token.content;
		const user = await validateRequestUser(userId);

		if(!req.files[0]) throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.IMAGE_MISSING);
	
		rating = await OutfitRatingsDB.create({
			userId,
			mode: 'OUTFIT_RATING'
		});

		const image = req.files[0];

		const storagePaths = new StoragePaths(user.id);
		ratingFolderPath = `${storagePaths.outfitRatingsPath}/${rating.id}`;

		console.log('Creating directory:', ratingFolderPath);
		mkdir(ratingFolderPath);

		const imagePath = `${storagePaths.outfitRatingsPath}/${rating.id}/outfit.jpg`;
		console.log('Saving file to:', ratingFolderPath, 'as outfit.jpg');
		console.log('File buffer size:', image.buffer?.length || 'NO BUFFER');
		saveFile(ratingFolderPath, image, `outfit.jpg`);

		// Construct proper image URL - remove /v3 from config.domains.api and add /v3/storage prefix
		const baseUrl = config.domains.api.replace('/v3', '');
		const imageUrl = `${baseUrl}/v3/${imagePath}`;

		console.log(`AI Request Image URL: ${imageUrl}`)
		const prompt = [{
			role: "user",
			content: [
				{ type: "text", text: config.openAI.prompts.tone },
				{ type: "text", text: config.openAI.prompts.rules },
				{ type: "text", text: config.openAI.prompts.outfitRating.replace('${paletteData}', await getPalette(user)).replace('${lang}', language) },
				{ type: "text", text: config.openAI.prompts.garmentCategories },
				{
					type: "image_url",
					image_url: {
						"url": imageUrl,
					},
				},
				// {
				// 	type: "image_url",
				// 	image_url: {
				// 		"url": `${config.domains.api}/${storagePaths.userPath}/palette.jpg`,
				// 	},
				// },
			],
		}]

		try {
			let response = await claudeRequest(prompt);
			const messageContent = response.choices[0].message.content;

			if(messageContent.includes("no_clothes_detected")) throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.NO_CLOTHES_DETECTED);
			if(messageContent.includes("more_than_one_person_detected")) throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.NO_CLOTHES_DETECTED);

			const message = JSON.parse(response.choices[0].message.content);
			
			await rating.update({ score: message['score'], response: message });
			
			Analytics.logFunctionUsage(userId, FunctionCodes.OUTFIT_RATING);
			respondOK(res, StatusCodes.OK, rating);
		} catch (error) {
			if(error instanceof ApiError) throw error;
			throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, ErrorCodes.SERVER_ERROR);
		}
	} catch (exception) {
		if(rating) {
			rating.destroy();
			rmdir(ratingFolderPath);
		}
        respondError(res, exception);
    }
}