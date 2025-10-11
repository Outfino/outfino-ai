import createAIController from './src/controllers/ai_controller.js';
import createAIRoutes from './src/routes/ai_routes.js';

/**
 * Outfino AI Module
 *
 * This module provides AI-powered image analysis and outfit rating functionality
 * using Claude CLI for local inference.
 *
 * Usage:
 * ```
 * import outfinoAI from 'outfino-ai';
 *
 * const aiModule = outfinoAI.initialize(apiDependencies);
 * app.use('/v3/ai', aiModule.routes);
 * ```
 */

export default {
	/**
	 * Initialize the Outfino AI module with API dependencies
	 * @param {Object} apiDeps - Dependencies from the main API
	 * @param {Function} apiDeps.respondOK - Success response utility
	 * @param {Function} apiDeps.respondError - Error response utility
	 * @param {Object} apiDeps.StatusCodes - HTTP status codes
	 * @param {Object} apiDeps.OutfitRatingsDB - Outfit ratings database model
	 * @param {Function} apiDeps.mkdir - Create directory utility
	 * @param {Class} apiDeps.StoragePaths - Storage paths utility
	 * @param {Function} apiDeps.saveFile - Save file utility
	 * @param {Function} apiDeps.validateRequestToken - Token validation middleware
	 * @param {Function} apiDeps.validateRequestUser - User validation middleware
	 * @param {Class} apiDeps.ApiError - API error class
	 * @param {Object} apiDeps.config - API configuration
	 * @param {Object} apiDeps.ErrorCodes - Error codes
	 * @param {Function} apiDeps.rmdir - Remove directory utility
	 * @param {Object} apiDeps.IdealColorsDB - Ideal colors database model
	 * @param {Object} apiDeps.Analytics - Analytics service
	 * @param {Object} apiDeps.FunctionCodes - Function codes for analytics
	 * @param {Function} apiDeps.getPalette - Get user palette utility
	 * @param {Function} apiDeps.generateActionFigure - Generate action figure utility
	 * @returns {Object} - AI module with routes and controller
	 */
	initialize(apiDeps) {
		const aiController = createAIController(apiDeps);
		const routes = createAIRoutes(aiController);

		return {
			routes,
			controller: aiController
		};
	}
};
