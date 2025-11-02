import aiRequest from "../../../utils/ai_request/ai_request.js";

export default async function matchProducts(req, res, apiDeps) {
	const {
		respondOK,
		respondError,
		StatusCodes,
		validateRequestToken,
		validateRequestUser,
		ApiError,
		ErrorCodes,
		config,
		ProductsDB
	} = apiDeps;

	try {
		const token = await validateRequestToken(req.headers.authorization);
		const userId = token.content;
		await validateRequestUser(userId);

		const { outfitAnalysis } = req.body;

		if (!outfitAnalysis) {
			throw new ApiError(StatusCodes.BAD_REQUEST, ErrorCodes.INVALID_REQUEST);
		}

		// Fetch all clothing products (with or without AI descriptions)
		// First get BrandsDB from apiDeps if available
		const BrandsDB = apiDeps.BrandsDB || (await import('../../../models/brands_model.js')).default;

		const products = await ProductsDB.findAll({
			where: {
				is_clothing: true,
				is_active: true
			},
			attributes: ['id', 'brand_id', 'name', 'ai_description', 'original_description', 'clothing_category', 'images', 'variants', 'price_data'],
			include: [{
				model: BrandsDB,
				as: 'brand',
				attributes: ['id', 'store_name', 'logo']
			}],
			limit: 100
		});

		console.log(`📦 Found ${products.length} products in database`);

		if (products.length === 0) {
			console.log('⚠️ No products available for matching');
			return respondOK(res, StatusCodes.OK, {
				matched_products: [],
				message: 'No products available'
			});
		}

		// Build product descriptions for AI (use ai_description or fallback to original_description)
		const productDescriptions = products
			.filter(p => p.ai_description || p.original_description) // Only include products with some description
			.map(p => ({
				id: p.id,
				name: p.name,
				category: p.clothing_category,
				description: p.ai_description || p.original_description || p.name
			}));

		console.log(`🤖 Sending ${productDescriptions.length} products to AI for matching (${products.length} total in DB)`);

		// Create AI prompt to match products
		const prompt = [{
			role: "user",
			content: [
				{
					type: "text",
					text: `You are a fashion stylist AI. Based on this outfit analysis:

${JSON.stringify(outfitAnalysis, null, 2)}

From these available products:
${JSON.stringify(productDescriptions, null, 2)}

Select up to 6 products that would complement or improve this outfit. Consider:
1. Color harmony and matching
2. Style compatibility (e.g., streetwear, elegant, casual)
3. Category recommendations from the outfit analysis
4. Missing pieces that could elevate the look

Respond in JSON format:
{
  "matched_products": [
    {
      "id": "product_id",
      "reason": "Brief explanation why this product matches"
    }
  ]
}

Be selective - only include products that genuinely match well.`
				}
			]
		}];

		console.log('📤 Requesting AI product matching...');
		const aiResponse = await aiRequest(prompt, { config });
		const responseContent = aiResponse.choices[0].message.content;

		console.log('📥 AI response received:', responseContent);

		// Parse AI response
		let matchedData;
		try {
			matchedData = JSON.parse(responseContent);
		} catch (parseError) {
			// Try to extract JSON from markdown code blocks
			const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
			if (jsonMatch) {
				matchedData = JSON.parse(jsonMatch[1]);
			} else {
				throw new Error('Failed to parse AI response');
			}
		}

		// Enrich matched products with full product data
		let enrichedProducts = matchedData.matched_products.map(match => {
			const product = products.find(p => p.id === match.id);
			if (!product) return null;

			// Parse images if stored as string
			let images = product.images;
			if (typeof images === 'string') {
				try {
					images = JSON.parse(images);
				} catch (e) {
					images = [];
				}
			}

			// Parse variants if stored as string
			let variants = product.variants;
			if (typeof variants === 'string') {
				try {
					variants = JSON.parse(variants);
				} catch (e) {
					variants = [];
				}
			}

			// Parse price_data if stored as string
			let priceData = product.price_data;
			if (typeof priceData === 'string') {
				try {
					priceData = JSON.parse(priceData);
				} catch (e) {
					priceData = null;
				}
			}

			// Get brand data
			const brand = product.brand || product.Brand;

			return {
				id: product.id,
				name: product.name,
				description: product.ai_description || '',
				category: product.clothing_category,
				images: Array.isArray(images) ? images.map(img => {
					// If img is already an object with src, return it
					if (typeof img === 'object' && img.src) {
						return {
							src: img.src,
							width: img.width || null,
							height: img.height || null
						};
					}
					// If img is a string URL, wrap it in an object
					return {
						src: img,
						width: null,
						height: null
					};
				}) : [],
				variants: Array.isArray(variants) ? variants : [],
				price: priceData,
				brand: brand ? {
					id: brand.id,
					name: brand.store_name || brand.name,
					logo: brand.logo
				} : null,
				reason: match.reason
			};
		}).filter(p => p !== null);

		console.log(`✅ Matched ${enrichedProducts.length} products`);

		respondOK(res, StatusCodes.OK, {
			matched_products: enrichedProducts,
			total_available: products.length
		});

	} catch (exception) {
		console.error('❌ Product matching error:', exception);
		respondError(res, exception);
	}
}
