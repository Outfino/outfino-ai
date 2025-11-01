import aiRequest from "../../../utils/ai_request/ai_request.js";

export default async function outfitRating(req, res, apiDeps) {
	// apiDeps contains all API dependencies injected from the main API
	const {
		respondOK,
		respondError,
		StatusCodes,
		OutfitRatingsDB,
		UsersDB,
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

	const eventCode = req.query.eventCode;
	const language = req.headers.language;

	// Check if this is an event-based request (no authentication required)
	if (eventCode) {
		return handleEventBasedRating(req, res, apiDeps, eventCode, language);
	}

	// Original user-based rating logic
	let rating;
	let ratingFolderPath;
	try {
		const token = await validateRequestToken(req.headers.authorization);

		const userId = token.content;
		const user = await validateRequestUser(userId);

		if(!req.files[0]) throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.IMAGE_MISSING);

		const friendsOnly = req.body.friendsOnly === true || req.body.friendsOnly === 'true';

		rating = await OutfitRatingsDB.create({
			userId,
			mode: 'OUTFIT_RATING',
			friendsOnly
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
			console.log('📤 Sending request to AI provider...');
			let response = await aiRequest(prompt, { config, OutfitRatingsDB });
			const messageContent = response.choices[0].message.content;

			console.log('📥 Received response from Claude, parsing...');

			// Check for special error cases
			if(messageContent.includes("no_clothes_detected")) {
				console.log('⚠️ No clothes detected in image');
				throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.NO_CLOTHES_DETECTED);
			}
			if(messageContent.includes("more_than_one_person_detected")) {
				console.log('⚠️ More than one person detected in image');
				throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.NO_CLOTHES_DETECTED);
			}

			const message = JSON.parse(response.choices[0].message.content);
			console.log('✅ Successfully parsed AI response, score:', message['score']);

			await rating.update({ score: message['score'], response: message });

			Analytics.logFunctionUsage(userId, FunctionCodes.OUTFIT_RATING);

			// Update streak when user creates an outfit rating
			await updateStreak(user, UsersDB);

			console.log('✅ Outfit rating completed successfully');
			respondOK(res, StatusCodes.OK, rating);
		} catch (error) {
			console.error('❌ Error during AI processing:', error.message);
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

/**
 * Handle event-based outfit rating (no authentication required)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} apiDeps - API dependencies
 * @param {string} eventCode - Event code to validate
 * @param {string} language - Language for AI prompts
 */
async function handleEventBasedRating(req, res, apiDeps, eventCode, language) {
	const {
		respondOK,
		respondError,
		StatusCodes,
		mkdir,
		saveFile,
		ApiError,
		config,
		ErrorCodes,
		EventsDB,
		EventPhotosDB,
		OutfitRatingsDB
	} = apiDeps;

	try {
		console.log('🎫 Event-based rating request for code:', eventCode);

		// Validate event code (using 'name' field as the code)
		const event = await EventsDB.findOne({ where: { name: eventCode } });
		if (!event) {
			console.log('❌ Invalid event code:', eventCode);
			throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.EVENT_NOT_FOUND);
		}

		console.log('✅ Event found:', event.id, '-', event.name);

		// Validate file
		if (!req.files || !req.files[0]) {
			throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.IMAGE_MISSING);
		}

		const image = req.files[0];
		const photoId = Date.now() + '-' + Math.random().toString(36).substring(7);
		const eventPath = `storage/events/${event.id}`;
		const photoFilename = `${photoId}.jpg`;

		// Save file
		console.log('💾 Saving photo to:', eventPath);
		saveFile(eventPath, image, photoFilename);

		// Construct public URL
		const photoUrl = `storage/events/${event.id}/${photoFilename}`;
		const baseUrl = config.domains.api.replace('/v3', '');
		const publicUrl = `${baseUrl}/v3/${photoUrl}`;

		console.log('🔗 Photo URL:', publicUrl);

		// Request AI evaluation
		console.log('🤖 Requesting AI evaluation...');
		const prompt = [{
			role: "user",
			content: [
				{ type: "text", text: config.openAI.prompts.tone },
				{ type: "text", text: config.openAI.prompts.rules },
				{ type: "text", text: config.openAI.prompts.outfitRating.replace('${paletteData}', '').replace('${lang}', language || 'hu') },
				{ type: "text", text: config.openAI.prompts.garmentCategories },
				{
					type: "image_url",
					image_url: {
						"url": publicUrl,
					},
				},
			],
		}];

		const aiResponse = await aiRequest(prompt, { config, OutfitRatingsDB });
		const messageContent = aiResponse.choices[0].message.content;

		// Check for special error cases
		if (messageContent.includes("no_clothes_detected")) {
			console.log('⚠️ No clothes detected in image');
			throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.NO_CLOTHES_DETECTED);
		}
		if (messageContent.includes("more_than_one_person_detected")) {
			console.log('⚠️ More than one person detected in image');
			throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.NO_CLOTHES_DETECTED);
		}

		const aiEvaluation = JSON.parse(messageContent);
		console.log('✅ AI evaluation completed, score:', aiEvaluation['score']);

		// Create database entry
		const photo = await EventPhotosDB.create({
			eventId: event.id,
			photoUrl,
			outfitRatingId: null
		});

		console.log('✅ Photo saved to database:', photo.id);

		// Return response in outfit rating format
		respondOK(res, StatusCodes.OK, {
			id: photo.id,
			images: [publicUrl],
			score: aiEvaluation['score'],
			response: aiEvaluation
		});

	} catch (exception) {
		console.error('❌ Event-based rating error:', exception);
		respondError(res, exception);
	}
}

/**
 * Updates user's streak count based on outfit rating creation
 * @param {Object} user - User object from database
 * @param {Object} UsersDB - Users database model
 */
async function updateStreak(user, UsersDB) {
	const streakDate = new Date(user.dataValues['streak']);
	const currentDate = new Date();

	// Normalize dates to start of day for comparison
	const streakStartDate = new Date(streakDate.getFullYear(), streakDate.getMonth(), streakDate.getDate());
	const currentStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

	const differenceInTime = currentStartDate - streakStartDate;
	const differenceInDays = Math.floor(differenceInTime / (1000 * 60 * 60 * 24));

	if (differenceInDays === 0) {
		// Same day - no update needed
		console.log('🔥 Streak: Same day, no update');
		return;
	} else if (differenceInDays === 1) {
		// Consecutive day - increment streak
		const newStreakCount = (user.dataValues['streakCount'] || 0) + 1;
		await user.update({
			streak: currentDate,
			streakCount: newStreakCount
		});
		console.log(`🔥 Streak: Incremented to ${newStreakCount}`);
	} else if (differenceInDays >= 2) {
		// Streak broken - reset to 1
		await user.update({
			streak: currentDate,
			streakCount: 1
		});
		console.log('🔥 Streak: Reset to 1 (streak broken)');
	}
}