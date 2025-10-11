import claudeRequest from "../../../utils/ai_request/claude_request.js";

export default async function generatePalette(req, res, apiDeps) {
	const {
		respondOK,
		respondError,
		StatusCodes,
		validateRequestToken,
		validateRequestUser,
		StoragePaths,
		saveFile,
		ApiError,
		ErrorCodes,
		IdealColorsDB,
		config,
		Analytics,
		FunctionCodes,
		generateActionFigure
	} = apiDeps;

	try {
		const token = await validateRequestToken(req.headers.authorization);

		const userId = token.content;
		const user = await validateRequestUser(userId);

		if(!req.files[0]) throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.IMAGE_MISSING);

		const storagePaths = new StoragePaths(user.id);
		saveFile(storagePaths.userPath, req.files[0], 'palette.jpg');

		try {

			const aiMessage = await setStyle(user, config, IdealColorsDB);
			await createActionFigure(user, generateActionFigure);
			let idealColors = await IdealColorsDB.findAll({ where: { userId: user.id } });

			Analytics.logFunctionUsage(userId, FunctionCodes.STYLE_PALETTE);
			respondOK(res, StatusCodes.OK, {
				"face_shape": aiMessage['face_shape'],
				"ideal_colors": idealColors
			});
		} catch (error) {
			if(error instanceof ApiError) throw error;
			throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, ErrorCodes.SERVER_ERROR);
		}
	} catch (exception) {
		respondError(res, exception);
	}
}

async function setStyle(user, config, IdealColorsDB) {
	const prompt = [
		{
			role: "user",
			content: [
				{ type: "text", text: config.openAI.prompts.rules },
				{ type: "text", text: config.openAI.prompts.analyzePalette },
				{
					type: "image_url",
					image_url: {
						"url": `${config.domains.api}/storage/users/${user.id}/palette.jpg`,
					},
				},
			],
		},
	];

	let response = await claudeRequest(prompt);
	const aiMessage = JSON.parse(response.choices[0].message.content);

	IdealColorsDB.destroy({ where: { userId: user.id } });
	await user.update({ faceShape: aiMessage['face_shape'], gender: aiMessage['gender'] });

	if (aiMessage.colors) {
		for (const color of aiMessage.colors) {
			await IdealColorsDB.create({
				userId: user.id,
				name: color.name,
				hex: color.hex,
				type: color.type
			});
		}
	}

	return aiMessage;
}

async function createActionFigure(user, generateActionFigure) {
	const file = await generateActionFigure(user.id);
	return file;
}
