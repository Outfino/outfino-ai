import claudeRequest from "../../../utils/ai_request/claude_request.js";

export default async function suitsMeRating(req, res, apiDeps) {
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
		IdealColorsDB,
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
			mode: 'SUITS_ME'
		});

		const image = req.files[0];

		const storagePaths = new StoragePaths(user.id);
		ratingFolderPath = `${storagePaths.outfitRatingsPath}/${rating.id}`;
		mkdir(ratingFolderPath);

		const imagePath = `${storagePaths.outfitRatingsPath}/${rating.id}/garment.jpg`;
		saveFile(ratingFolderPath, image, `garment.jpg`);

		const idealColors = await IdealColorsDB.findAll({ where: { userId } });

		const prompt = [{
			role: "user",
			content: [
				{ type: "text", text: config.openAI.prompts.tone },
				{ type: "text", text: config.openAI.prompts.rules },
				{ type: "text", text: config.openAI.prompts.suitsMe.replace('${paletteData}', await getPalette(user)).replace('${lang}', language) },
				{
					type: "image_url",
					image_url: {
						"url": `${config.domains.api}/${imagePath}`,
					},
				},
				{
					type: "image_url",
					image_url: {
						"url": `${config.domains.api}/${storagePaths.userPath}/palette.jpg`,
					},
				},
			],
		}]

		try {
			let response = await claudeRequest(prompt);
			const messageContent = response.choices[0].message.content;

			if(messageContent.includes("no_clothes_detected")) throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.NO_CLOTHES_DETECTED);
			if(messageContent.includes("more_than_one_person_detected")) throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.NO_CLOTHES_DETECTED);

			const message = JSON.parse(messageContent);

			await rating.update({ score: message['score'], response: message });

			Analytics.logFunctionUsage(userId, FunctionCodes.SUITS_ME);
			respondOK(res, StatusCodes.OK, message);
		} catch (error) {
			if(error instanceof ApiError) throw error;
			throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, ErrorCodes.SERVER_ERROR);
		}
	} catch (exception) {
		rating.destroy();
		rmdir(ratingFolderPath);
        respondError(res, exception);
    }
}
