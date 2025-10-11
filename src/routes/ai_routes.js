import express from 'express';
import multer from 'multer';
const upload = multer();

/**
 * Create AI routes with the given controller
 * @param {Object} aiController - The AI controller instance
 * @returns {express.Router} - Express router with AI routes
 */
export default function createAIRoutes(aiController) {
	const router = express.Router();

	router.post('/rating/outfit-rating', upload.array('files'), aiController.outfitRating);
	router.post('/rating/suits-me', upload.array('files'), aiController.suitsMeRating);
	router.post('/rating/which-is-better', upload.array('files'), aiController.whichIsBetterRating);
	router.post('/generate-palette', upload.array('files'), aiController.generatePalette);

	return router;
}
