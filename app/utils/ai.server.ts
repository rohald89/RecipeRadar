import { z } from 'zod'
import { OpenAIProvider } from './providers/openai.server.ts'

const openai = OpenAIProvider.client()

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const
export type Difficulty = typeof DIFFICULTIES[number]

const RecipeSchema = z.object({
	title: z.string(),
	cookingTime: z.number().min(1),
	difficulty: z.enum(DIFFICULTIES),
	ingredients: z.array(
		z.object({
			item: z.string(),
			amount: z.string(),
		}),
	),
	instructions: z.array(z.string()),
	nutritionalInfo: z.object({
		calories: z.number().min(0),
		protein: z.number().min(0),
		carbs: z.number().min(0),
		fat: z.number().min(0),
	}),
})

const RecipeResponseSchema = z.object({
	detectedIngredients: z.array(
		z.object({
			name: z.string(),
			category: z.string(),
			quantity: z.string().optional(),
		}),
	),
	suggestedRecipes: z.array(RecipeSchema),
})

export type Recipe = z.infer<typeof RecipeSchema>
export type RecipeResponse = z.infer<typeof RecipeResponseSchema>

export async function analyzeFridgeContents(imageUrl: string) {
	const completion = await openai.chat.completions.create({
		model: 'gpt-4o',
		messages: [
			{
				role: 'system',
				content: `You are a kitchen assistant that identifies ingredients in a fridge or pantry.
					If the image is empty, unclear, or doesn't contain food items, respond with "NO_INGREDIENTS_FOUND".
					Otherwise, list all visible food items and ingredients, categorized by type (produce, dairy, meat, etc).
					Only include items that are clearly visible and identifiable.`,
			},
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: 'What ingredients can you identify in this image? Group them by category.',
					},
					{
						type: 'image_url',
						image_url: {
							url: imageUrl,
						},
					},
				],
			},
		],
		max_tokens: 500,
	})

	const content = completion.choices[0]?.message.content ?? ''
	return content === 'NO_INGREDIENTS_FOUND' ? null : content
}


export async function generateRecipes(ingredients: string) {
	const completion = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		messages: [
			{
				role: 'system',
				content: `You are a cooking assistant that generates recipes. Return a raw JSON response (no markdown formatting) with the following structure:
					{
						"detectedIngredients": [
							{ "name": string, "category": string, "quantity": string }
						],
						"suggestedRecipes": [{
							"title": string,
							"cookingTime": number,
							"difficulty": "EASY" | "MEDIUM" | "HARD",
							"ingredients": [
								{ "item": string, "amount": string }
							],
							"instructions": string[],
							"nutritionalInfo": {
								"calories": number,
								"protein": number,
								"carbs": number,
								"fat": number
							}
						}]
					}`,
			},
			{
				role: 'user',
				content: `Generate recipes using these ingredients: ${ingredients}`,
			},
		],
	})

	const content = completion.choices[0]?.message.content ?? ''
	// Clean markdown formatting if present
	const jsonString = content.replace(/```json\n?|\n?```/g, '').trim()

	const parsed = RecipeResponseSchema.safeParse(JSON.parse(jsonString))

	if (!parsed.success) {
		console.error('Failed to parse recipe response:', parsed.error)
		throw new Error('Failed to generate recipes')
	}

	return parsed.data
}

export async function analyzeImage(imageUrl: string) {
	const ingredients = await analyzeFridgeContents(imageUrl)
	if (!ingredients) {
		throw new Error('No ingredients were detected in the image. Please try again with a clearer photo of food items')
	}
	return ingredients
}

export async function generateRecipesFromIngredients(ingredients: string) {
	const recipes = await generateRecipes(ingredients)
	return recipes
}
