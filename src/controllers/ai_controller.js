import outfitRating from './methods/ai/outfit_rating.js';
import suitsMeRating from './methods/ai/suits_me_rating.js';
import whichIsBetterRating from './methods/ai/which_is_better_rating.js';
import generatePalette from './methods/ai/generate_palette.js';

/**
 * AI Controller with dependency injection
 * All API dependencies are injected via the apiDeps parameter
 */
export default function createAIController(apiDeps) {
	return {
		outfitRating: (req, res) => outfitRating(req, res, apiDeps),
		suitsMeRating: (req, res) => suitsMeRating(req, res, apiDeps),
		whichIsBetterRating: (req, res) => whichIsBetterRating(req, res, apiDeps),
		generatePalette: (req, res) => generatePalette(req, res, apiDeps)
	};
}
